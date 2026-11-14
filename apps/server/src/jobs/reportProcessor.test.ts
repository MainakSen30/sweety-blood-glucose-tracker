import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { closeTestPool, resetDatabase } from '../../tests/database.js';
import { db } from '../database/index.js';
import { doctorPatientAssignments, users } from '../database/schema.js';
import { todayInAppTimezone } from '../utils/date.js';
import { previousMonthRange } from '../modules/reports/reports.service.js';
import * as readingsRepository from '../modules/readings/readings.repository.js';
import * as reportsRepository from '../modules/reports/reports.repository.js';
import { registerUser } from '../modules/auth/auth.service.js';
import { processReportJob, type ReportJobLike } from './reportProcessor.js';

/**
 * Worker-processor tests against the real PostgreSQL test database with the
 * Redis client seam replaced by an in-memory double (same pattern as the
 * Phase 11 cache wiring tests). Proves the processor reuses the existing
 * cached reporting wrappers, uses the payload's server-side user id, reports
 * progress stages, and fails correctly.
 */

const fake = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    store,
    client: {
      status: 'ready',
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      incr: vi.fn(async (key: string) => {
        const next = Number(store.get(key) ?? 0) + 1;
        store.set(key, String(next));
        return next;
      }),
    },
  };
});

vi.mock('../cache/redisClient.js', () => ({
  getRedisClient: () => fake.client,
  getRedisStatus: () => 'ready',
  createRedisClient: vi.fn(),
  closeRedis: vi.fn(async () => undefined),
}));

// Spies around the real repositories so call counts prove cache reuse.
vi.mock('../modules/readings/readings.repository.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../modules/readings/readings.repository.js')>();
  return {
    ...actual,
    listReadings: vi.fn((...args: Parameters<typeof actual.listReadings>) =>
      actual.listReadings(...args),
    ),
  };
});

vi.mock('../modules/reports/reports.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/reports/reports.repository.js')>();
  return {
    ...actual,
    aggregateUserReadings: vi.fn((...args: Parameters<typeof actual.aggregateUserReadings>) =>
      actual.aggregateUserReadings(...args),
    ),
  };
});

const listReadingsSpy = vi.mocked(readingsRepository.listReadings);
const aggregateSpy = vi.mocked(reportsRepository.aggregateUserReadings);

async function makeUser(email: string): Promise<string> {
  const session = await registerUser({
    name: 'Job User',
    email,
    password: 'SecurePassword123',
  });
  return session.user.id;
}

async function makeDoctor(email: string): Promise<string> {
  const doctorId = await makeUser(email);
  await db.update(users).set({ role: 'doctor' }).where(eq(users.id, doctorId));
  return doctorId;
}

async function assign(doctorId: string, patientId: string): Promise<void> {
  await db.insert(doctorPatientAssignments).values({
    doctorId,
    patientId,
    status: 'active',
    acceptedAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
}

function jobFor(data: unknown): ReportJobLike & { updateProgress: ReturnType<typeof vi.fn> } {
  return { data, updateProgress: vi.fn(async () => undefined) };
}

beforeEach(async () => {
  vi.clearAllMocks();
  fake.store.clear();
  await resetDatabase();
});

describe('processReportJob', () => {
  it('generates a daily report for the payload user through the cached wrappers', async () => {
    const userId = await makeUser('job-daily@example.com');
    await readingsRepository.insertReading({
      userId,
      readingDate: '2026-01-15',
      slot: 'morning',
      value: 100,
    });
    await readingsRepository.insertReading({
      userId,
      readingDate: '2026-01-15',
      slot: 'after_lunch',
      value: 150,
    });

    const job = jobFor({ userId, reportType: 'daily', date: '2026-01-15' });
    const report = await processReportJob(job);

    expect(report).toEqual({
      reportType: 'daily',
      date: '15-01-2026',
      summary: { highest: 150, lowest: 100, average: 125, totalReadings: 2 },
      readings: [
        { id: expect.any(String), readingDate: '15-01-2026', slot: 'morning', value: 100 },
        { id: expect.any(String), readingDate: '15-01-2026', slot: 'after_lunch', value: 150 },
      ],
    });
    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 10);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 50);
  });

  it('generates a previous-month report for the payload user', async () => {
    const userId = await makeUser('job-monthly@example.com');
    const period = previousMonthRange(todayInAppTimezone());
    await readingsRepository.insertReading({
      userId,
      readingDate: period.startDate,
      slot: 'morning',
      value: 88,
    });

    const job = jobFor({ userId, reportType: 'monthly' });
    const report = await processReportJob(job);

    expect(report).toMatchObject({
      reportType: 'monthly',
      summary: { highest: 88, lowest: 88, average: 88, totalReadings: 1 },
    });
    expect(aggregateSpy).toHaveBeenCalledWith(userId, period.startDate, period.endDate);
  });

  it('serves a second identical job from the report cache without new queries', async () => {
    const userId = await makeUser('job-cache@example.com');
    await readingsRepository.insertReading({
      userId,
      readingDate: '2026-02-10',
      slot: 'morning',
      value: 120,
    });

    const first = await processReportJob(
      jobFor({ userId, reportType: 'daily', date: '2026-02-10' }),
    );
    const listCallsAfterFirst = listReadingsSpy.mock.calls.length;

    const second = await processReportJob(
      jobFor({ userId, reportType: 'daily', date: '2026-02-10' }),
    );

    expect(second).toEqual(first);
    // The Phase 11 cache absorbed the repeat — no new PostgreSQL query.
    expect(listReadingsSpy.mock.calls.length).toBe(listCallsAfterFirst);
  });

  it('fails permanently on a structurally invalid payload without querying', async () => {
    const job = jobFor({ reportType: 'daily', date: '2026-01-15' }); // no userId

    await expect(processReportJob(job)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(job.updateProgress).not.toHaveBeenCalled();
    expect(listReadingsSpy).not.toHaveBeenCalled();
  });

  it('fails permanently on an unknown report type', async () => {
    const job = jobFor({ userId: 'user-1', reportType: 'yearly' });

    await expect(processReportJob(job)).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('propagates database failures as retryable errors', async () => {
    const userId = await makeUser('job-dbfail@example.com');
    aggregateSpy.mockRejectedValueOnce(new Error('PostgreSQL connection failed'));

    const job = jobFor({ userId, reportType: 'monthly' });

    let capturedError: unknown;
    try {
      await processReportJob(job);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe('PostgreSQL connection failed');
    expect(capturedError).not.toBeInstanceOf(UnrecoverableError);
  });

  it('generates a doctor-requested report only while consent is active', async () => {
    const patientId = await makeUser('job-patient@example.com');
    const doctorId = await makeDoctor('job-doctor@example.com');
    await assign(doctorId, patientId);
    await readingsRepository.insertReading({
      userId: patientId,
      readingDate: '2026-03-05',
      slot: 'morning',
      value: 101,
    });

    const job = jobFor({
      userId: patientId,
      requestedBy: doctorId,
      reportType: 'daily',
      date: '2026-03-05',
    });
    const report = await processReportJob(job);
    expect(report).toMatchObject({ reportType: 'daily', summary: { totalReadings: 1 } });

    await db
      .update(doctorPatientAssignments)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(doctorPatientAssignments.doctorId, doctorId));

    const afterRevoke = jobFor({
      userId: patientId,
      requestedBy: doctorId,
      reportType: 'daily',
      date: '2026-03-05',
    });

    await expect(processReportJob(afterRevoke)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(afterRevoke.updateProgress).not.toHaveBeenCalled();
  });

  it('rejects a doctor-requested job with no active assignment', async () => {
    const patientId = await makeUser('job-patient-2@example.com');
    const doctorId = await makeDoctor('job-doctor-2@example.com');

    const job = jobFor({
      userId: patientId,
      requestedBy: doctorId,
      reportType: 'monthly',
    });

    await expect(processReportJob(job)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(aggregateSpy).not.toHaveBeenCalled();
  });
});

afterAll(async () => {
  await closeTestPool();
});
