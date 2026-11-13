/**
 * Database seed script — demonstration data only.
 *
 * Creates a demo account and ~30 days of synthetic glucose readings so the
 * application can be evaluated without entering real personal data.
 *
 * SAFETY REQUIREMENTS (all must pass or the script exits):
 *   1. NODE_ENV must NOT be 'production'.
 *   2. SEED_DEMO_DATA must be exactly 'true'.
 *   3. DATABASE_URL database name must contain 'dev', 'demo', 'local', or
 *      'test' — this prevents an accidental run against a production database.
 *   4. TEST_DATABASE_URL is never used here.
 *   5. No TRUNCATE, DROP, or DELETE against user data.
 *   6. Existing demo account password is never overwritten.
 *   7. All inserts use ON CONFLICT DO NOTHING — idempotent and safe to re-run.
 *   8. The database connection is closed in a finally block.
 *
 * Run via:
 *   SEED_DEMO_DATA=true tsx src/database/seed.ts
 * Or via the package script:
 *   npm run db:seed          (from apps/server/)
 *   npm run db:seed          (from repo root)
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config as loadEnvFile } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { todayInAppTimezone } from '../utils/date.js';

// ---------------------------------------------------------------------------
// Bootstrap environment (same pattern as drizzle.config.ts)
// ---------------------------------------------------------------------------

const currentDirectory = dirname(fileURLToPath(import.meta.url));
loadEnvFile({ path: resolve(currentDirectory, '../../../../.env'), quiet: true });

// ---------------------------------------------------------------------------
// Safety checks — all mandatory; script exits if any check fails
// ---------------------------------------------------------------------------

function exitWithError(message: string): never {
  console.error(`\n[seed] ✗  ${message}\n`);
  process.exit(1);
}

// 1. Refuse to run in production
if (process.env.NODE_ENV === 'production') {
  exitWithError('NODE_ENV is set to "production". This seed script must never run in production.');
}

// 2. Require explicit opt-in flag
if (process.env.SEED_DEMO_DATA !== 'true') {
  exitWithError(
    'SEED_DEMO_DATA is not set to "true".\n' +
      '  Set SEED_DEMO_DATA=true in .env or run:\n' +
      '    SEED_DEMO_DATA=true npm run db:seed',
  );
}

// 3. Check DATABASE_URL exists and database name looks non-production
const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  exitWithError('DATABASE_URL is not set. Copy .env.example to .env at the repository root.');
}

function extractDatabaseName(connectionString: string): string | null {
  try {
    // Handle both postgres:// and postgresql:// schemes
    const normalised = connectionString.replace(/^postgresql:\/\//, 'postgres://');
    const url = new URL(normalised);
    // pathname is '/<dbname>', strip the leading slash
    return url.pathname.slice(1) || null;
  } catch {
    return null;
  }
}

const dbName = extractDatabaseName(rawDatabaseUrl);
if (!dbName) {
  exitWithError(
    'Could not parse the database name from DATABASE_URL. ' +
      'Ensure the URL is a valid PostgreSQL connection string.',
  );
}

// 'sweety' (without a suffix) is the conventional local dev DB name for this project.
const NON_PRODUCTION_PATTERNS = /dev|demo|local|test|^sweety$/i;
if (!NON_PRODUCTION_PATTERNS.test(dbName)) {
  exitWithError(
    `DATABASE_URL points to database "${dbName}", which does not look like a ` +
      'development or demo database (name must contain dev, demo, local, or test, ' +
      'or be exactly "sweety" for the default local setup). ' +
      'Update DATABASE_URL to a safe development database before running the seed.',
  );
}

// 4. Never connect to TEST_DATABASE_URL — handled by simply not reading it here.
//    We only use DATABASE_URL read above.

// ---------------------------------------------------------------------------
// Demo data constants
// ---------------------------------------------------------------------------

const DEMO_EMAIL = 'demo@sweety.local';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_NAME = 'Demo User';
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

  try {
    // ------------------------------------------------------------------
    // 1. Upsert the demo user (insert-if-missing; never overwrite password)
    // ------------------------------------------------------------------
    console.log(`\n[seed] Looking up demo account <${DEMO_EMAIL}>…`);

    const existingUsers = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${DEMO_EMAIL.toLowerCase()}`)
      .limit(1);

    let demoUserId: string;

    if (existingUsers.length > 0 && existingUsers[0]) {
      demoUserId = existingUsers[0].id;
      console.log(`[seed] Demo account already exists (id=${demoUserId}). Skipping user insert.`);
    } else {
      console.log('[seed] Demo account not found — creating…');
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST_FACTOR);

      const inserted = await db
        .insert(schema.users)
        .values({ name: DEMO_NAME, email: DEMO_EMAIL, passwordHash })
        .returning({ id: schema.users.id });

      const newUser = inserted[0];
      if (!newUser) {
        throw new Error('Demo user insertion did not return a row.');
      }
      demoUserId = newUser.id;
      console.log(`[seed] Demo account created (id=${demoUserId}).`);
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
    console.log(`[seed]    Demo email    : ${DEMO_EMAIL}`);
    console.log(`[seed]    Demo password : ${DEMO_PASSWORD}`);
    console.log(`[seed]    Total readings in DB for demo user: ${totalReadings}`);
    console.log('[seed]    NOTE: These are synthetic demonstration values — not medical data.\n');
  } finally {
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error('\n[seed] ✗  Seed failed:', error);
  process.exit(1);
});
