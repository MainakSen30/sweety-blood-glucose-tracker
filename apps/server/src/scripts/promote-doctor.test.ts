import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../database/index.js';
import { userRoleChanges, users } from '../database/schema.js';
import { registerUser } from '../modules/auth/auth.service.js';
import { closeTestPool, resetDatabase } from '../../tests/database.js';
import {
  extractDatabaseName,
  parsePromotionArgs,
  promoteUserToDoctor,
  validatePromotionGuards,
} from './promote-doctor.js';

const SAFE_URL = 'postgresql://sweety:sweety@localhost:5432/sweety_dev';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestPool();
});

describe('doctor promotion guards', () => {
  it('parses the database name', () => {
    expect(extractDatabaseName(SAFE_URL)).toBe('sweety_dev');
    expect(extractDatabaseName('not a url')).toBeNull();
  });

  it('accepts a development database', () => {
    expect(validatePromotionGuards({ NODE_ENV: 'development', DATABASE_URL: SAFE_URL })).toBeNull();
  });

  it('refuses tests, missing URLs, and test database names', () => {
    expect(validatePromotionGuards({ NODE_ENV: 'test', DATABASE_URL: SAFE_URL })).toContain('test');
    expect(validatePromotionGuards({ DATABASE_URL: undefined })).toContain('DATABASE_URL');
    expect(
      validatePromotionGuards({
        DATABASE_URL: 'postgresql://sweety:sweety@localhost:5432/sweety_test',
      }),
    ).toContain('test database');
    expect(
      validatePromotionGuards({
        DATABASE_URL: 'postgresql://sweety:sweety@localhost:5432/sweety-test',
      }),
    ).toContain('test database');
    expect(
      validatePromotionGuards({ DATABASE_URL: SAFE_URL, TEST_DATABASE_URL: SAFE_URL }),
    ).toContain('same database');
  });

  it('requires an email and an operator name', () => {
    expect(parsePromotionArgs(['doctor@example.com', '--by=Ops'])).toEqual({
      email: 'doctor@example.com',
      changedBy: 'Ops',
    });
    expect(parsePromotionArgs(['doctor@example.com', '--by', 'Ops'])).toEqual({
      email: 'doctor@example.com',
      changedBy: 'Ops',
    });
    expect(parsePromotionArgs(['doctor@example.com'])).toBeNull();
    expect(parsePromotionArgs(['--by=Ops'])).toBeNull();
    expect(parsePromotionArgs(['doctor@example.com', '--by='])).toBeNull();
  });
});

describe('promoteUserToDoctor', () => {
  it('promotes a patient, records the audit row, and is idempotent', async () => {
    await registerUser({
      name: 'Future Doctor',
      email: 'promote-me@example.com',
      password: 'SecurePassword123',
    });

    const first = await promoteUserToDoctor(db, {
      email: 'PROMOTE-ME@example.com',
      changedBy: 'Ops Person',
    });

    expect(first.state).toBe('promoted');

    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, 'promote-me@example.com'));
    expect(user?.role).toBe('doctor');

    const audit = await db.select().from(userRoleChanges);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      previousRole: 'patient',
      newRole: 'doctor',
      changedBy: 'Ops Person',
    });

    const second = await promoteUserToDoctor(db, {
      email: 'promote-me@example.com',
      changedBy: 'Ops Person',
    });
    expect(second.state).toBe('already_doctor');
    expect(await db.select().from(userRoleChanges)).toHaveLength(1);
  });

  it('reports a missing account without changing anything', async () => {
    const outcome = await promoteUserToDoctor(db, {
      email: 'missing@example.com',
      changedBy: 'Ops Person',
    });

    expect(outcome.state).toBe('not_found');
    expect(await db.select().from(userRoleChanges)).toHaveLength(0);
  });

  it('refuses to write an empty operator name', async () => {
    await registerUser({
      name: 'Future Doctor',
      email: 'promote-me@example.com',
      password: 'SecurePassword123',
    });

    await expect(
      promoteUserToDoctor(db, { email: 'promote-me@example.com', changedBy: '   ' }),
    ).rejects.toThrow('operator name');
  });
});
