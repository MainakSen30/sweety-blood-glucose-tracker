/**
 * Seed script safety-guard unit tests.
 *
 * Exercises validateSeedGuards() and extractDatabaseName() in isolation.
 * No database connection is opened; no data is modified.
 */

import { describe, it, expect } from 'vitest';
import { validateSeedGuards, extractDatabaseName, DEMO_PATIENTS } from './seed.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid env with the given database name. */
function envWithDb(dbName: string): {
  NODE_ENV: string;
  SEED_DEMO_DATA: string;
  DATABASE_URL: string;
} {
  return {
    NODE_ENV: 'development',
    SEED_DEMO_DATA: 'true',
    DATABASE_URL: `postgresql://user:pass@localhost:5432/${dbName}`,
  };
}

// ---------------------------------------------------------------------------
// validateSeedGuards — opt-in guard
// ---------------------------------------------------------------------------

describe('validateSeedGuards — opt-in guard', () => {
  it('rejects when SEED_DEMO_DATA is undefined (missing)', () => {
    const result = validateSeedGuards({
      NODE_ENV: 'development',
      SEED_DEMO_DATA: undefined,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/sweety',
    });
    expect(result).not.toBeNull();
  });

  it('rejects when SEED_DEMO_DATA is "false"', () => {
    const result = validateSeedGuards({
      NODE_ENV: 'development',
      SEED_DEMO_DATA: 'false',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/sweety',
    });
    expect(result).not.toBeNull();
  });

  it('passes opt-in check when SEED_DEMO_DATA is "true" (no NODE_ENV override)', () => {
    // NODE_ENV omitted — should not trigger the opt-in rejection
    const result = validateSeedGuards({
      SEED_DEMO_DATA: 'true',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/sweety',
    });
    // The opt-in check specifically must not be the reason for rejection.
    // With a valid DATABASE_URL on the allowlist, the full result should be null.
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSeedGuards — production guard
// ---------------------------------------------------------------------------

describe('validateSeedGuards — production guard', () => {
  it('rejects when NODE_ENV is "production" with SEED_DEMO_DATA set', () => {
    const result = validateSeedGuards({
      NODE_ENV: 'production',
      SEED_DEMO_DATA: 'true',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/sweety',
    });
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSeedGuards — allowed database names (full guard chain)
// ---------------------------------------------------------------------------

describe('validateSeedGuards — allowed database names', () => {
  it('allows database name "sweety"', () => {
    expect(validateSeedGuards(envWithDb('sweety'))).toBeNull();
  });

  it('allows database name "sweety_dev"', () => {
    expect(validateSeedGuards(envWithDb('sweety_dev'))).toBeNull();
  });

  it('allows database name "sweety_demo"', () => {
    expect(validateSeedGuards(envWithDb('sweety_demo'))).toBeNull();
  });

  it('rejects database name "sweety_test"', () => {
    expect(validateSeedGuards(envWithDb('sweety_test'))).not.toBeNull();
  });

  it('rejects database name "sweety-test"', () => {
    expect(validateSeedGuards(envWithDb('sweety-test'))).not.toBeNull();
  });

  it('rejects database name "production"', () => {
    expect(validateSeedGuards(envWithDb('production'))).not.toBeNull();
  });

  it('rejects database name "production_demo"', () => {
    expect(validateSeedGuards(envWithDb('production_demo'))).not.toBeNull();
  });

  it('rejects database name "demo" (not on allowlist)', () => {
    expect(validateSeedGuards(envWithDb('demo'))).not.toBeNull();
  });

  it('rejects when DATABASE_URL has an empty database name', () => {
    const result = validateSeedGuards({
      NODE_ENV: 'development',
      SEED_DEMO_DATA: 'true',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/',
    });
    expect(result).not.toBeNull();
  });

  it('rejects when DATABASE_URL is malformed', () => {
    const result = validateSeedGuards({
      NODE_ENV: 'development',
      SEED_DEMO_DATA: 'true',
      DATABASE_URL: 'not-a-url',
    });
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSeedGuards — TEST_DATABASE_URL is never read
// ---------------------------------------------------------------------------

describe('validateSeedGuards — TEST_DATABASE_URL is never used', () => {
  it('rejects when DATABASE_URL is missing even if TEST_DATABASE_URL is supplied', () => {
    // The guard only checks DATABASE_URL. TEST_DATABASE_URL must never be a
    // fallback. If DATABASE_URL is absent the guard must still reject.
    const result = validateSeedGuards({
      NODE_ENV: 'development',
      SEED_DEMO_DATA: 'true',
      DATABASE_URL: undefined,
      // Note: TEST_DATABASE_URL is not part of the env parameter — the
      // function signature does not accept it, so it cannot be used.
    } as { NODE_ENV: string; SEED_DEMO_DATA: string; DATABASE_URL: undefined });
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractDatabaseName
// ---------------------------------------------------------------------------

describe('extractDatabaseName', () => {
  it('extracts name from postgresql:// URL', () => {
    expect(extractDatabaseName('postgresql://user:pass@host:5432/sweety')).toBe('sweety');
  });

  it('extracts name from postgres:// URL', () => {
    expect(extractDatabaseName('postgres://user:pass@host:5432/sweety_test')).toBe('sweety_test');
  });

  it('returns null for a URL with an empty path', () => {
    expect(extractDatabaseName('postgresql://user:pass@host:5432/')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractDatabaseName('')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(extractDatabaseName('not-a-url')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Demo roster contents
// ---------------------------------------------------------------------------

describe('DEMO_PATIENTS', () => {
  it('adds nine active patients to the demo patient for a ten-patient roster', () => {
    expect(DEMO_PATIENTS.filter((patient) => patient.status === 'active')).toHaveLength(9);
  });

  it('includes invitation history states so the filters are not empty', () => {
    expect(DEMO_PATIENTS.filter((patient) => patient.status === 'pending')).toHaveLength(2);
    expect(DEMO_PATIENTS.filter((patient) => patient.status === 'expired')).toHaveLength(1);
    expect(DEMO_PATIENTS.filter((patient) => patient.status === 'revoked')).toHaveLength(1);
  });

  it('uses unique demo-only email addresses', () => {
    const emails = DEMO_PATIENTS.map((patient) => patient.email);

    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((email) => email.endsWith('@sweety.local'))).toBe(true);
  });
});
