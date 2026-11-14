/**
 * Guarded doctor provisioning CLI.
 *
 * Public registration only ever creates patients. A trusted operator promotes
 * an existing account with:
 *
 *   npm run db:promote-doctor -- doctor@example.com --by="Ops Name"
 *
 * The promotion is recorded in `user_role_changes`. There is deliberately no
 * HTTP endpoint for this: role escalation must be a deliberate operator
 * action with database access.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../database/schema.js';

export type Database = NodePgDatabase<typeof schema>;

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export function extractDatabaseName(connectionString: string): string | null {
  try {
    const normalised = connectionString.replace(/^postgresql:\/\//, 'postgres://');
    const url = new URL(normalised);
    return url.pathname.slice(1) || null;
  } catch {
    return null;
  }
}

export interface PromotionGuardEnv {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  TEST_DATABASE_URL?: string;
}

/**
 * The CLI must never run tests, and never against a database whose name marks
 * it as a test database (the suite truncates it). Returns an error message or
 * `null` when safe.
 */
export function validatePromotionGuards(env: PromotionGuardEnv): string | null {
  if (env.NODE_ENV === 'test') {
    return 'NODE_ENV is "test". Doctor promotion must not run against a test database.';
  }

  if (!env.DATABASE_URL) {
    return 'DATABASE_URL is not set. Copy .env.example to .env at the repository root.';
  }

  const databaseName = extractDatabaseName(env.DATABASE_URL);

  if (!databaseName) {
    return 'Could not parse the database name from DATABASE_URL.';
  }

  if (/_test$|-test$/i.test(databaseName)) {
    return `DATABASE_URL points to "${databaseName}", which looks like a test database.`;
  }

  if (env.TEST_DATABASE_URL && env.TEST_DATABASE_URL === env.DATABASE_URL) {
    return 'TEST_DATABASE_URL and DATABASE_URL point to the same database.';
  }

  return null;
}

export type PromotionOutcome =
  | { state: 'promoted'; userId: string; email: string }
  | { state: 'already_doctor'; userId: string; email: string }
  | { state: 'not_found' };

export async function promoteUserToDoctor(
  database: Database,
  input: { email: string; changedBy: string },
): Promise<PromotionOutcome> {
  const changedBy = input.changedBy.trim();

  if (!changedBy) {
    throw new Error('An operator name is required for the audit trail.');
  }

  return database.transaction(async (tx) => {
    const rows = await tx
      .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${input.email.trim().toLowerCase()}`)
      .limit(1)
      .for('update');

    const user = rows[0];

    if (!user) {
      return { state: 'not_found' as const };
    }

    if (user.role === 'doctor') {
      return { state: 'already_doctor' as const, userId: user.id, email: user.email };
    }

    await tx
      .update(schema.users)
      .set({ role: 'doctor', updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    await tx.insert(schema.userRoleChanges).values({
      userId: user.id,
      previousRole: user.role,
      newRole: 'doctor',
      changedBy,
    });

    return { state: 'promoted' as const, userId: user.id, email: user.email };
  });
}

/** Accepts `<email> --by="Name"` or `<email> --by Name`. */
export function parsePromotionArgs(argv: string[]): { email: string; changedBy: string } | null {
  let email: string | undefined;
  let changedBy: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;

    if (argument === '--by') {
      changedBy = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--by=')) {
      changedBy = argument.slice('--by='.length);
    } else if (!argument.startsWith('--')) {
      email ??= argument;
    }
  }

  if (!email || !changedBy || !changedBy.trim()) {
    return null;
  }

  return { email, changedBy: changedBy.trim() };
}

const currentModulePath = fileURLToPath(import.meta.url);
const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1] === currentModulePath ||
    process.argv[1].replace(/\.[jt]s$/, '') === currentModulePath.replace(/\.[jt]s$/, ''));

async function run(): Promise<void> {
  loadEnvFile({ path: resolve(currentDirectory, '../../../../.env'), quiet: true });

  const args = parsePromotionArgs(process.argv.slice(2));

  if (!args) {
    console.error(
      '\n[promote-doctor] Usage: npm run db:promote-doctor -- <email> --by="Operator"\n',
    );
    process.exit(1);
  }

  const guardError = validatePromotionGuards({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  });

  if (guardError) {
    console.error(`\n[promote-doctor] ✗  ${guardError}\n`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const database = drizzle(pool, { schema });

  try {
    const outcome = await promoteUserToDoctor(database, args);

    if (outcome.state === 'not_found') {
      console.error(`\n[promote-doctor] ✗  No account found for ${args.email}.\n`);
      process.exitCode = 1;
      return;
    }

    if (outcome.state === 'already_doctor') {
      console.log(`\n[promote-doctor] ${outcome.email} is already a doctor. No change made.\n`);
      return;
    }

    console.log(`\n[promote-doctor] ✔  Promoted ${outcome.email} to doctor.`);
    console.log(`[promote-doctor]    Audit: changed by "${args.changedBy}".\n`);
  } finally {
    await pool.end();
  }
}

if (isDirectExecution) {
  run().catch((error: unknown) => {
    console.error('\n[promote-doctor] ✗  Promotion failed:', error);
    process.exit(1);
  });
}
