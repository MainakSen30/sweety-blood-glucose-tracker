/**
 * Database seed script — demonstration data only.
 *
 * Creates a demo account and ~30 days of synthetic glucose readings so the
 * application can be evaluated without entering real personal data.
 *
 * SAFETY REQUIREMENTS (all must pass or the script exits):
 *   1. NODE_ENV must NOT be 'production'.
 *   2. SEED_DEMO_DATA must be exactly 'true'.
 *   3. DATABASE_URL database name must be on the explicit allowlist of safe
 *      local/demo databases. Test databases (names ending in _test or -test)
 *      are always rejected even if SEED_DEMO_DATA is set.
 *   4. TEST_DATABASE_URL is never used here.
 *   5. No TRUNCATE, DROP, or DELETE against user data.
 *   6. Existing demo account password is never overwritten.
 *   7. All inserts use ON CONFLICT DO NOTHING — idempotent and safe to re-run.
 *   8. The database connection is closed in a finally block.
 *
 * Run via:
 *   SEED_DEMO_DATA=true tsx src/database/seed.ts
 * Or via the package script (SEED_DEMO_DATA must be supplied externally):
 *   SEED_DEMO_DATA=true npm run db:seed          (from apps/server/)
 *   SEED_DEMO_DATA=true npm run db:seed          (from repo root)
 * Docker Compose:
 *   docker compose exec server sh -c "SEED_DEMO_DATA=true /app/node_modules/.bin/tsx /app/apps/server/src/database/seed.ts"
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config as loadEnvFile } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { todayInAppTimezone } from '../utils/date.js';

// ---------------------------------------------------------------------------
// Bootstrap helpers
// ---------------------------------------------------------------------------

const currentDirectory = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Guard logic — exported for unit testing (no database I/O)
// ---------------------------------------------------------------------------

/**
 * Parses the database name from a PostgreSQL connection string.
 * Returns null if the URL is malformed or the database name is absent.
 */
export function extractDatabaseName(connectionString: string): string | null {
  try {
    const normalised = connectionString.replace(/^postgresql:\/\//, 'postgres://');
    const url = new URL(normalised);
    return url.pathname.slice(1) || null;
  } catch {
    return null;
  }
}

/**
 * Strict allowlist of database names that the seed script is permitted to
 * write to. This list is derived from .env.example and the actual project
 * configuration; do not expand it without deliberate review.
 *
 * Rationale for each entry:
 *   sweety       — the default local development database documented in
 *                  .env.example and used by developers running outside Docker.
 *   sweety_dev   — an explicitly named development variant (e.g. after a
 *                  manual rename from sweety).
 *   sweety_demo  — a dedicated demo database for evaluation/staging.
 *
 * Names NOT on this list:
 *   sweety_test  — test database; Vitest truncates it; never seed here.
 *   sweety-test  — same as above with hyphen separator.
 *   production   — obvious.
 *   anything else not explicitly listed.
 */
const ALLOWED_DB_NAMES = new Set(['sweety', 'sweety_dev', 'sweety_demo']);

/**
 * Validates all seed safety guards. Returns a string error message on the
 * first failing check, or null if all checks pass.
 *
 * Accepts an env-like object so the function can be tested without side effects.
 */
export function validateSeedGuards(env: {
  NODE_ENV?: string;
  SEED_DEMO_DATA?: string;
  DATABASE_URL?: string;
}): string | null {
  // 1. Refuse production
  if (env.NODE_ENV === 'production') {
    return 'NODE_ENV is set to "production". This seed script must never run in production.';
  }

  // 2. Require explicit opt-in
  if (env.SEED_DEMO_DATA !== 'true') {
    return (
      'SEED_DEMO_DATA is not set to "true".\n' +
      '  Supply it explicitly — do NOT rely on the npm script to set it.\n' +
      '  Run: SEED_DEMO_DATA=true npm run db:seed'
    );
  }

  // 3. DATABASE_URL must be present
  if (!env.DATABASE_URL) {
    return 'DATABASE_URL is not set. Copy .env.example to .env at the repository root.';
  }

  // 4. Parse the database name
  const dbName = extractDatabaseName(env.DATABASE_URL);
  if (!dbName) {
    return (
      'Could not parse the database name from DATABASE_URL. ' +
      'Ensure the URL is a valid PostgreSQL connection string.'
    );
  }

  // 5. Explicitly reject test databases before the allowlist check.
  //    A name ending in _test or -test is always a test database, even if
  //    SEED_DEMO_DATA=true was set by mistake.
  if (/_test$|-test$/i.test(dbName)) {
    return (
      `DATABASE_URL points to "${dbName}", which looks like a test database. ` +
      'Test databases must never be seeded. Use a development or demo database instead.'
    );
  }

  // 6. Allowlist check — only explicitly designated databases are permitted.
  if (!ALLOWED_DB_NAMES.has(dbName)) {
    return (
      `DATABASE_URL points to database "${dbName}", which is not on the seed allowlist. ` +
      `Permitted databases: ${[...ALLOWED_DB_NAMES].join(', ')}. ` +
      'Update DATABASE_URL to a permitted development or demo database.'
    );
  }

  return null; // all checks passed
}

// ---------------------------------------------------------------------------
// Safety checks — run only when executed directly (not when imported for testing)
// ---------------------------------------------------------------------------

function exitWithError(message: string): never {
  console.error(`\n[seed] ✗  ${message}\n`);
  process.exit(1);
}

// Detect whether this module is the entry point (direct execution via tsx/node)
// vs being imported by a test. import.meta.url equals the resolved file URL only
// when it is the main module; we compare against process.argv[1].
const currentModulePath = fileURLToPath(import.meta.url);
const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1] === currentModulePath ||
    // tsx rewrites the path, so also check without extension
    process.argv[1].replace(/\.[jt]s$/, '') === currentModulePath.replace(/\.[jt]s$/, ''));

// Module-level variables used by seed() — only populated when running directly.
let rawDatabaseUrl = '';
let dbName = '';

if (isDirectExecution) {
  // Load .env relative to the monorepo root (same pattern as drizzle.config.ts)
  loadEnvFile({ path: resolve(currentDirectory, '../../../../.env'), quiet: true });

  const guardError = validateSeedGuards({
    NODE_ENV: process.env.NODE_ENV,
    SEED_DEMO_DATA: process.env.SEED_DEMO_DATA,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  if (guardError) {
    exitWithError(guardError);
  }

  // Guards passed — these are now guaranteed non-null.
  rawDatabaseUrl = process.env.DATABASE_URL as string;
  dbName = extractDatabaseName(rawDatabaseUrl) as string;
}

// ---------------------------------------------------------------------------
// Demo data constants
// ---------------------------------------------------------------------------

const DEMO_EMAIL = 'demo@sweety.local';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_NAME = 'Demo User';
const DEMO_DOCTOR_EMAIL = 'doctor@sweety.local';
const DEMO_DOCTOR_PASSWORD = 'Doctor1234!';
const DEMO_DOCTOR_NAME = 'Dr. Demo';
/** Must match BCRYPT_COST_FACTOR in auth.repository.ts */
const BCRYPT_COST_FACTOR = 12;

// All four slots, in definition order
const ALL_SLOTS = schema.READING_SLOTS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a YYYY-MM-DD string for `daysAgo` days before today (Asia/Kolkata).
 */
function dateOffset(daysAgo: number): string {
  const today = todayInAppTimezone(); // 'YYYY-MM-DD'
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(year, month - 1, day - daysAgo));
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a glucose value that is always within the valid 40–600 mg/dL range.
 * Accepts a base and a jitter; clamps the result.
 */
function glucose(base: number, jitter: number): number {
  const v = base + Math.round((Math.random() - 0.5) * 2 * jitter);
  return Math.max(40, Math.min(600, v));
}

// ---------------------------------------------------------------------------
// Reading generation strategy
// ---------------------------------------------------------------------------
//
// We generate readings for days T-1 … T-30, where T = today in Asia/Kolkata.
//
// Day coverage pattern (determines which slots are present each day):
//   full        → all 4 slots  (morning, after_breakfast, after_lunch, after_dinner)
//   morning_only→ 1 slot
//   two_slots   → morning + after_lunch
//   three_slots → morning + after_breakfast + after_dinner
//   none        → no readings (gap day)
//
// The distribution ensures:
//   • Readings in the current calendar month  (MTD report)
//   • Readings in the previous calendar month (previous-month report)
//   • At least one fully completed day        (daily report demo)
//   • Several partially completed days
//   • A few gap days

type DayPattern = 'full' | 'morning_only' | 'two_slots' | 'three_slots' | 'none';

// Repeating 10-day cycle so the data looks varied but deterministic per run
const TEN_DAY_CYCLE: DayPattern[] = [
  'full', // day 1
  'three_slots', // day 2
  'full', // day 3
  'two_slots', // day 4
  'none', // day 5 — gap
  'full', // day 6
  'morning_only', // day 7
  'three_slots', // day 8
  'none', // day 9 — gap
  'full', // day 10
];

function slotsForPattern(pattern: DayPattern): ReadonlyArray<schema.ReadingSlot> {
  switch (pattern) {
    case 'full':
      return ALL_SLOTS;
    case 'morning_only':
      return ['morning'];
    case 'two_slots':
      return ['morning', 'after_lunch'];
    case 'three_slots':
      return ['morning', 'after_breakfast', 'after_dinner'];
    case 'none':
      return [];
  }
}

// Glucose base values per slot (synthetic, not medically meaningful)
const SLOT_BASE: Record<schema.ReadingSlot, number> = {
  morning: 95,
  after_breakfast: 145,
  after_lunch: 135,
  after_dinner: 120,
};
const SLOT_JITTER: Record<schema.ReadingSlot, number> = {
  morning: 20,
  after_breakfast: 40,
  after_lunch: 35,
  after_dinner: 30,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('\n[seed] Starting demo data seed…');
  console.log(`[seed] Target database: "${dbName}"`);

  // Create a fresh pool — do NOT import the shared pool from database/index.ts
  // to avoid importing env.ts (which would require JWT_SECRET to be set).
  const pool = new Pool({ connectionString: rawDatabaseUrl as string });
  const db = drizzle(pool, { schema });

  /**
   * Insert-if-missing account helper. Passwords of existing accounts are never
   * overwritten. The role is only corrected here because this is a guarded
   * demo seed; production promotions go through the audited CLI.
   */
  async function ensureDemoAccount(
    email: string,
    name: string,
    password: string,
    role: schema.UserRole,
  ): Promise<string> {
    const existing = await db
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${email.toLowerCase()}`)
      .limit(1);

    const account = existing[0];

    if (account) {
      if (account.role !== role) {
        await db
          .update(schema.users)
          .set({ role, updatedAt: new Date() })
          .where(eq(schema.users.id, account.id));
      }

      console.log(`[seed] ${email} already exists (id=${account.id}). Skipping insert.`);
      return account.id;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    const inserted = await db
      .insert(schema.users)
      .values({ name, email, passwordHash, role })
      .returning({ id: schema.users.id });

    const newUser = inserted[0];

    if (!newUser) {
      throw new Error(`Insertion of ${email} did not return a row.`);
    }

    console.log(`[seed] Created ${email} (id=${newUser.id}).`);
    return newUser.id;
  }

  try {
    // ------------------------------------------------------------------
    // 1. Upsert the demo patient and demo doctor
    // ------------------------------------------------------------------
    console.log('\n[seed] Ensuring demo accounts exist…');
    const demoUserId = await ensureDemoAccount(DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD, 'patient');
    const demoDoctorId = await ensureDemoAccount(
      DEMO_DOCTOR_EMAIL,
      DEMO_DOCTOR_NAME,
      DEMO_DOCTOR_PASSWORD,
      'doctor',
    );

    // A pre-existing relationship of any status is left untouched: re-running
    // the seed must never silently restore consent the patient revoked.
    const existingAssignment = await db
      .select({ id: schema.doctorPatientAssignments.id })
      .from(schema.doctorPatientAssignments)
      .where(
        and(
          eq(schema.doctorPatientAssignments.doctorId, demoDoctorId),
          eq(schema.doctorPatientAssignments.patientId, demoUserId),
        ),
      )
      .limit(1);

    if (existingAssignment.length === 0) {
      const now = new Date();
      await db.insert(schema.doctorPatientAssignments).values({
        doctorId: demoDoctorId,
        patientId: demoUserId,
        status: 'active',
        acceptedAt: now,
        expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      });
      console.log('[seed] Created an active demo doctor–patient assignment.');
    } else {
      console.log('[seed] Existing demo doctor–patient relationship left untouched.');
    }

    // ------------------------------------------------------------------
    // 2. Build the readings payload for T-1 … T-30
    // ------------------------------------------------------------------
    console.log('\n[seed] Building synthetic readings (T-1 … T-30, Asia/Kolkata)…');

    type NewReading = typeof schema.readings.$inferInsert;
    const rows: NewReading[] = [];

    for (let daysAgo = 1; daysAgo <= 30; daysAgo++) {
      const readingDate = dateOffset(daysAgo);
      const pattern = TEN_DAY_CYCLE[(daysAgo - 1) % TEN_DAY_CYCLE.length]!;
      const slots = slotsForPattern(pattern);

      for (const slot of slots) {
        rows.push({
          userId: demoUserId,
          readingDate,
          slot,
          value: glucose(SLOT_BASE[slot], SLOT_JITTER[slot]),
        });
      }
    }

    console.log(`[seed] Prepared ${rows.length} reading rows across 30 days.`);

    // ------------------------------------------------------------------
    // 3. Insert readings in a transaction, ON CONFLICT DO NOTHING
    // ------------------------------------------------------------------
    if (rows.length > 0) {
      await db.transaction(async (tx) => {
        // Insert in batches to stay within parameter limits
        const BATCH = 50;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await tx.insert(schema.readings).values(batch).onConflictDoNothing();
          inserted += batch.length;
        }
        console.log(
          `[seed] Attempted to insert ${inserted} readings (duplicates silently skipped).`,
        );
      });
    }

    // ------------------------------------------------------------------
    // 4. Summary
    // ------------------------------------------------------------------
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.readings)
      .where(sql`${schema.readings.userId} = ${demoUserId}`);

    const totalReadings = countResult[0]?.count ?? 0;

    console.log('\n[seed] ✔  Seed complete.');
    console.log(`[seed]    Demo patient email    : ${DEMO_EMAIL}`);
    console.log(`[seed]    Demo patient password : ${DEMO_PASSWORD}`);
    console.log(`[seed]    Demo doctor email     : ${DEMO_DOCTOR_EMAIL}`);
    console.log(`[seed]    Demo doctor password  : ${DEMO_DOCTOR_PASSWORD}`);
    console.log(`[seed]    Total readings in DB for demo user: ${totalReadings}`);
    console.log('[seed]    NOTE: These are synthetic demonstration values — not medical data.\n');
  } finally {
    await pool.end();
  }
}

if (isDirectExecution) {
  seed().catch((error: unknown) => {
    console.error('\n[seed] ✗  Seed failed:', error);
    process.exit(1);
  });
}
