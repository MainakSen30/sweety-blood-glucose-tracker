/**
 * Unit tests for seed script safety guards.
 *
 * These tests exercise the guard logic in isolation — no database connection
 * is opened and no data is modified.
 */

import { describe, it, expect } from 'vitest';
import { extractDatabaseName, validateSeedGuards } from './seed.js';

// ---------------------------------------------------------------------------
// extractDatabaseName
// ---------------------------------------------------------------------------

describe('extractDatabaseName', () => {
  it('parses a postgres:// URL', () => {
    expect(extractDatabaseName('postgres://user:pass@localhost:5432/sweety')).toBe('sweety');
  });

  it('parses a postgresql:// URL', () => {
    expect(extractDatabaseName('postgresql://user:pass@localhost:5432/sweety_dev')).toBe(
      'sweety_dev',
    );
  });

  it('returns null for a malformed URL', () => {
    expect(extractDatabaseName('not-a-url')).toBeNull();
  });

  it('returns null when the path is empty', () => {
    expect(extractDatabaseName('postgres://user:pass@localhost:5432/')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractDatabaseName('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSeedGuards — opt-in flag
// ---------------------------------------------------------------------------

const BASE_ENV = {
  NODE_ENV: 'development',
  SEED_DEMO_DATA: 'true',
  DATABASE_URL: 'postgresql://sweety:pass@localhost:5432/sweety',
};

describe('validateSeedGuards — SEED_DEMO_DATA', () => {
  it('passes when SEED_DEMO_DATA is exactly "true"', () => {
    expect(validateSeedGuards(BASE_ENV)).toBeNull();
  });

  it('rejects when SEED_DEMO_DATA is missing', () => {
    const result = validateSeedGuards({ ...BASE_ENV, SEED_DEMO_DATA: undefined });
    expect(result).not.toBeNull();
    expect(result).toContain('SEED_DEMO_DATA');
  });

  it('rejects when SEED_DEMO_DATA is "false"', () => {
    const result = validateSeedGuards({ ...BASE_ENV, SEED_DEMO_DATA: 'false' });
    expect(result).not.toBeNull();
    expect(result).toContain('SEED_DEMO_DATA');
  });

  it('rejects when SEED_DEMO_DATA is "True" (case-sensitive)', () => {
    const result = validateSeedGuards({ ...BASE_ENV, SEED_DEMO_DATA: 'True' });
    expect(result).not.toBeNull();
  });

  it('rejects when SEED_DEMO_DATA is "1"', () => {
    const result = validateSeedGuards({ ...BASE_ENV, SEED_DEMO_DATA: '1' });
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSeedGuards — NODE_ENV production guard
// ---------------------------------------------------------------------------

describe('validateSeedGuards — NODE_ENV', () => {
  it('rejects when NODE_ENV is "production"', () => {
    const result = validateSeedGuards({ ...BASE_ENV, NODE_ENV: 'production' });
    expect(result).not.toBeNull();
    expect(result).toContain('production');
  });

  it('passes when NODE_ENV is "development"', () => {
    expect(validateSeedGuards({ ...BASE_ENV, NODE_ENV: 'development' })).toBeNull();
  });

  it('passes when NODE_ENV is undefined (not set)', () => {
    // Not production — should pass the production check
    expect(validateSeedGuards({ ...BASE_ENV, NODE_ENV: undefined })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSeedGuards — DATABASE_URL presence
// ---------------------------------------------------------------------------

describe('validateSeedGuards — DATABASE_URL presence', () => {
  it('rejects when DATABASE_URL is missing', () => {
    const result = validateSeedGuards({ ...BASE_ENV, DATABASE_URL: undefined });
    expect(result).not.toBeNull();
    expect(result).toContain('DATABASE_URL');
  });

  it('rejects when DATABASE_URL is a malformed string', () => {
    const result = validateSeedGuards({ ...BASE_ENV, DATABASE_URL: 'not-a-url' });
    expect(result).not.toBeNull();
    expect(result).toContain('parse');
  });
});

// ---------------------------------------------------------------------------
// validateSeedGuards — database name allowlist
// ---------------------------------------------------------------------------

describe('validateSeedGuards — allowed database names', () => {
  function withDb(dbName: string) {
    return { ...BASE_ENV, DATABASE_URL: `postgresql://u:p@localhost:5432/${dbName}` };
  }

  // Allowed
  it('allows database name "sweety" (default local dev)', () => {
    expect(validateSeedGuards(withDb('sweety'))).toBeNull();
  });

  it('allows database name "sweety_dev"', () => {
    expect(validateSeedGuards(withDb('sweety_dev'))).toBeNull();
  });

  it('allows database name "sweety_demo"', () => {
    expect(validateSeedGuards(withDb('sweety_demo'))).toBeNull();
  });

  // Explicitly rejected — test databases
  it('rejects database name "sweety_test"', () => {
    const result = validateSeedGuards(withDb('sweety_test'));
    expect(result).not.toBeNull();
    expect(result).toContain('test database');
  });

  it('rejects database name "sweety-test"', () => {
    const result = validateSeedGuards(withDb('sweety-test'));
    expect(result).not.toBeNull();
    expect(result).toContain('test database');
  });

  it('rejects a name ending in _test even if it also contains "demo"', () => {
    const result = validateSeedGuards(withDb('sweety_demo_test'));
    expect(result).not.toBeNull();
    expect(result).toContain('test database');
  });

  // Rejected — not on allowlist
  it('rejects database name "production"', () => {
    const result = validateSeedGuards(withDb('production'));
    expect(result).not.toBeNull();
    expect(result).toContain('allowlist');
  });

  it('rejects database name "production-demo"', () => {
    const result = validateSeedGuards(withDb('production-demo'));
    expect(result).not.toBeNull();
    expect(result).toContain('allowlist');
  });

  it('rejects database name "demo" (not in configured allowlist)', () => {
    // "demo" alone is not an explicitly designated project database name
    const result = validateSeedGuards(withDb('demo'));
    expect(result).not.toBeNull();
    expect(result).toContain('allowlist');
  });

  it('rejects database name "sweety2" (not on allowlist)', () => {
    const result = validateSeedGuards(withDb('sweety2'));
    expect(result).not.toBeNull();
    expect(result).toContain('allowlist');
  });

  it('rejects an empty database name', () => {
    // URL with trailing slash and no db name
    const result = validateSeedGuards({
      ...BASE_ENV,
      DATABASE_URL: 'postgresql://u:p@localhost:5432/',
    });
    expect(result).not.toBeNull();
  });
});
