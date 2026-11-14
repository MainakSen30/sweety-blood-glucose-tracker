import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../utils/errors.js';

/**
 * Unit tests for the BullMQ queue module. The `bullmq` module is replaced by
 * a controllable fake, so no Redis server is needed; the real behaviour under
 * test is the idempotency logic, ownership checks, option building, and the
 * 503 degradation when the queue is unreachable.
 */

const access = vi.hoisted(() => ({
  hasActiveAssignment: vi.fn(async () => true),
}));

const bullmq = vi.hoisted(() => {
  const created: Array<{ name: string; opts: Record<string, unknown> }> = [];
  let getJobImpl: (jobId: string) => Promise<unknown> = async () => null;
  let addImpl: ((...args: unknown[]) => Promise<unknown>) | null = null;

  class FakeQueue {
    name: string;
    opts: Record<string, unknown>;

    constructor(name: string, opts: Record<string, unknown>) {
      this.name = name;
      this.opts = opts;
      created.push({ name, opts });
    }

    getJob(jobId: string): Promise<unknown> {
      return getJobImpl(jobId);
    }

    async add(...args: unknown[]): Promise<unknown> {
      if (addImpl) {
        return addImpl(...args);
      }
      throw new Error('unexpected add call');
    }

    async close(): Promise<void> {
      return undefined;
    }
  }

  return {
    created,
    FakeQueue,
    setGetJob(impl: (jobId: string) => Promise<unknown>): void {
      getJobImpl = impl;
    },
    setAdd(impl: ((...args: unknown[]) => Promise<unknown>) | null): void {
      addImpl = impl;
    },
    reset(): void {
      getJobImpl = async () => null;
      addImpl = null;
      created.length = 0;
    },
  };
});

// The queue module (and, transitively, the cache module) reads configuration;
// a controlled env keeps this file independent of the process environment.
vi.mock('../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://test-host:6379',
    REDIS_CACHE_TTL_SECONDS: 60,
    REPORT_JOB_ATTEMPTS: 3,
    REPORT_JOB_BACKOFF_MS: 1000,
    REPORT_JOB_RETENTION_SECONDS: 3600,
  },
}));

vi.mock('bullmq', () => ({
  Queue: bullmq.FakeQueue,
  Worker: vi.fn(),
  Job: class {},
  UnrecoverableError: class UnrecoverableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnrecoverableError';
    }
  },
}));

// The queue re-checks doctor consent on result retrieval; this unit suite
// replaces the database-backed check with a controllable spy.
vi.mock('../modules/access/access.repository.js', () => ({
  hasActiveAssignment: access.hasActiveAssignment,
}));

import {
  REPORT_QUEUE_NAME,
  REPORT_QUEUE_PREFIX,
  buildReportJobId,
  buildReportJobOptions,
  closeReportQueue,
  findOwnedReportJob,
  getReportJobResult,
  getReportJobStatus,
  reportJobPayloadSchema,
  submitReportJob,
} from './reportQueue.js';

interface FakeJobInit {
  userId: string;
  requestedBy?: string;
  state: string;
  returnvalue?: unknown;
  failedReason?: string;
}

function fakeJob(init: FakeJobInit) {
  return {
    id: 'rpt:job-1',
    data: {
      userId: init.userId,
      ...(init.requestedBy ? { requestedBy: init.requestedBy } : {}),
      reportType: 'daily',
      date: '2026-01-15',
    },
    returnvalue: init.returnvalue,
    failedReason: init.failedReason,
    progress: null,
    getState: async () => init.state,
    remove: vi.fn(async () => undefined),
  };
}

const dailyParams = { reportType: 'daily' as const, date: '2026-01-15' };

beforeEach(async () => {
  bullmq.reset();
  access.hasActiveAssignment.mockReset();
  access.hasActiveAssignment.mockResolvedValue(true);
  // Drop the module-level queue singleton so every test starts unconfigured.
  await closeReportQueue();
});

describe('queue configuration', () => {
  it('creates one namespaced queue on the existing Redis', () => {
    // getReportQueue is exercised indirectly through submitReportJob below;
    // construct it through a lookup to inspect options.
    bullmq.setAdd(async () => ({ id: 'rpt:x', getState: async () => 'waiting' }));
    void submitReportJob('user-1', dailyParams);

    expect(bullmq.created).toHaveLength(1);
    expect(bullmq.created[0]!.name).toBe(REPORT_QUEUE_NAME);
    expect(bullmq.created[0]!.opts.prefix).toBe(REPORT_QUEUE_PREFIX);
    const connection = bullmq.created[0]!.opts.connection as Record<string, unknown>;
    expect(connection.url).toBe('redis://test-host:6379');
    // BullMQ's blocking connections require maxRetriesPerRequest: null.
    expect(connection.maxRetriesPerRequest).toBeNull();
  });

  it('reuses a single queue instance', async () => {
    bullmq.setAdd(async () => ({ id: 'rpt:x', getState: async () => 'waiting' }));
    await submitReportJob('user-1', dailyParams);
    await submitReportJob('user-2', dailyParams);
    expect(bullmq.created).toHaveLength(1);
  });

  it('builds the retry and retention policy from configuration', () => {
    expect(buildReportJobOptions()).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 3600 },
    });
  });

  it('derives a deterministic, user-scoped job id', () => {
    expect(buildReportJobId({ userId: 'user-1', reportType: 'daily', date: '2026-01-15' })).toBe(
      'rpt_user-1_daily_2026-01-15',
    );
    expect(buildReportJobId({ userId: 'user-1', reportType: 'monthly' })).toBe(
      'rpt_user-1_monthly_monthly',
    );
    expect(
      buildReportJobId({ userId: 'user-1', reportType: 'monthly', date: '2026-09-15' }),
    ).toBe('rpt_user-1_monthly_2026-09-15');
    // Distinct reference dates produce distinct job ids
    expect(
      buildReportJobId({ userId: 'user-1', reportType: 'monthly', date: '2026-09-15' }),
    ).not.toBe(
      buildReportJobId({ userId: 'user-1', reportType: 'monthly', date: '2026-10-15' }),
    );
    // Different users never share a job id.
    expect(
      buildReportJobId({ userId: 'user-2', reportType: 'daily', date: '2026-01-15' }),
    ).not.toBe(buildReportJobId({ userId: 'user-1', reportType: 'daily', date: '2026-01-15' }));
  });
});

describe('reportJobPayloadSchema', () => {
  it('accepts a valid payload', () => {
    expect(
      reportJobPayloadSchema.parse({ userId: 'user-1', reportType: 'daily', date: '2026-01-15' }),
    ).toEqual({ userId: 'user-1', reportType: 'daily', date: '2026-01-15' });
    expect(reportJobPayloadSchema.parse({ userId: 'user-1', reportType: 'monthly' })).toEqual({
      userId: 'user-1',
      reportType: 'monthly',
    });
    expect(
      reportJobPayloadSchema.parse({ userId: 'user-1', reportType: 'monthly', date: '2026-09-15' }),
    ).toEqual({
      userId: 'user-1',
      reportType: 'monthly',
      date: '2026-09-15',
    });
  });

  it('rejects payloads without a user id or with an invalid date', () => {
    expect(() =>
      reportJobPayloadSchema.parse({ reportType: 'daily', date: '2026-01-15' }),
    ).toThrow();
    expect(() =>
      reportJobPayloadSchema.parse({ userId: 'user-1', reportType: 'daily', date: '15-01-2026' }),
    ).toThrow();
    expect(() => reportJobPayloadSchema.parse({ userId: 'user-1', reportType: 'daily' })).toThrow();
    expect(() =>
      reportJobPayloadSchema.parse({ userId: 'user-1', reportType: 'nonsense' }),
    ).toThrow();
  });
});

describe('submitReportJob — idempotency', () => {
  it('adds a new job with the deterministic id and job options', async () => {
    const addedJob = { id: 'rpt_user-1_daily_2026-01-15', getState: async () => 'waiting' };
    bullmq.setAdd(async (...args: unknown[]) => {
      expect(args[0]).toBe('generate');
      expect(args[1]).toEqual({ userId: 'user-1', ...dailyParams });
      expect(args[2]).toMatchObject({ jobId: 'rpt_user-1_daily_2026-01-15', attempts: 3 });
      return addedJob;
    });

    const submission = await submitReportJob('user-1', dailyParams);
    expect(submission).toEqual({ jobId: 'rpt_user-1_daily_2026-01-15', status: 'waiting' });
  });

  it('returns the existing job while a duplicate is still in flight', async () => {
    const existing = fakeJob({ userId: 'user-1', state: 'active' });
    const addSpy = vi.fn();
    bullmq.setGetJob(async () => existing);
    bullmq.setAdd(addSpy);

    const submission = await submitReportJob('user-1', dailyParams);

    expect(submission).toEqual({ jobId: 'rpt_user-1_daily_2026-01-15', status: 'active' });
    expect(existing.remove).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('replaces a completed job so a later request regenerates fresh data', async () => {
    let existing: ReturnType<typeof fakeJob> | null = fakeJob({
      userId: 'user-1',
      state: 'completed',
      returnvalue: { reportType: 'daily' },
    });
    bullmq.setGetJob(async () => {
      const job = existing;
      existing = null; // removed below
      return job;
    });
    bullmq.setAdd(async () => ({ id: 'rpt:x', getState: async () => 'waiting' }));

    const submission = await submitReportJob('user-1', dailyParams);

    expect(submission).toEqual({ jobId: 'rpt:x', status: 'waiting' });
  });

  it('replaces a failed job the same way', async () => {
    let existing: ReturnType<typeof fakeJob> | null = fakeJob({
      userId: 'user-1',
      state: 'failed',
    });
    bullmq.setGetJob(async () => {
      const job = existing;
      existing = null;
      return job;
    });
    bullmq.setAdd(async () => ({ id: 'rpt:x', getState: async () => 'waiting' }));

    await expect(submitReportJob('user-1', dailyParams)).resolves.toMatchObject({
      status: 'waiting',
    });
  });

  it('degrades to a 503 when the queue is unreachable', async () => {
    bullmq.setGetJob(async () => {
      throw new Error('Connection refused');
    });

    await expect(submitReportJob('user-1', dailyParams)).rejects.toMatchObject({
      statusCode: 503,
    } satisfies Partial<HttpError>);
  });
});

describe('ownership and status/result lookups', () => {
  it('findOwnedReportJob returns only the owner’s job', async () => {
    bullmq.setGetJob(async () => fakeJob({ userId: 'user-1', state: 'waiting' }));

    expect(await findOwnedReportJob('rpt:x', 'user-1')).not.toBeNull();
    expect(await findOwnedReportJob('rpt:x', 'user-2')).toBeNull();
  });

  it('findOwnedReportJob returns null for unknown jobs and 503 on Redis failure', async () => {
    bullmq.setGetJob(async () => null);
    expect(await findOwnedReportJob('missing', 'user-1')).toBeNull();

    bullmq.setGetJob(async () => {
      throw new Error('timeout');
    });
    await expect(findOwnedReportJob('rpt:x', 'user-1')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('getReportJobStatus maps state, progress, and failure reason', async () => {
    bullmq.setGetJob(async () => ({
      ...fakeJob({
        userId: 'user-1',
        state: 'failed',
        failedReason: 'PostgreSQL connection failed',
      }),
      progress: 50,
    }));

    expect(await getReportJobStatus('rpt:x', 'user-1')).toEqual({
      jobId: 'rpt:job-1',
      status: 'failed',
      progress: 50,
      failedReason: 'PostgreSQL connection failed',
    });

    bullmq.setGetJob(async () => null);
    expect(await getReportJobStatus('rpt:x', 'user-2')).toBeNull();
  });

  it('getReportJobResult distinguishes completed, processing, and failed states', async () => {
    const report = { reportType: 'monthly', summary: { totalReadings: 1 } };
    bullmq.setGetJob(async () =>
      fakeJob({ userId: 'user-1', state: 'completed', returnvalue: report }),
    );
    expect(await getReportJobResult('rpt:x', 'user-1')).toEqual({ state: 'completed', report });

    bullmq.setGetJob(async () => fakeJob({ userId: 'user-1', state: 'active' }));
    expect(await getReportJobResult('rpt:x', 'user-1')).toEqual({ state: 'processing' });

    bullmq.setGetJob(async () =>
      fakeJob({ userId: 'user-1', state: 'failed', failedReason: 'boom' }),
    );
    expect(await getReportJobResult('rpt:x', 'user-1')).toEqual({
      state: 'failed',
      reason: 'boom',
    });
  });

  it('releases a doctor-requested result only while consent is active', async () => {
    const report = { reportType: 'daily', summary: { totalReadings: 2 } };
    bullmq.setGetJob(async () =>
      fakeJob({
        userId: 'patient-1',
        requestedBy: 'doctor-1',
        state: 'completed',
        returnvalue: report,
      }),
    );

    expect(await getReportJobResult('rpt:x', 'doctor-1', 'patient-1')).toEqual({
      state: 'completed',
      report,
    });
    expect(access.hasActiveAssignment).toHaveBeenCalledWith('doctor-1', 'patient-1');

    access.hasActiveAssignment.mockResolvedValueOnce(false);
    expect(await getReportJobResult('rpt:x', 'doctor-1', 'patient-1')).toBeNull();
  });

  it("does not consult consent for the patient's own job", async () => {
    bullmq.setGetJob(async () =>
      fakeJob({ userId: 'patient-1', state: 'completed', returnvalue: { ok: true } }),
    );

    expect(await getReportJobResult('rpt:x', 'patient-1')).toEqual({
      state: 'completed',
      report: { ok: true },
    });
    expect(access.hasActiveAssignment).not.toHaveBeenCalled();
  });

  it('only addresses a job under the patient path it was generated for', async () => {
    bullmq.setGetJob(async () =>
      fakeJob({
        userId: 'patient-1',
        requestedBy: 'doctor-1',
        state: 'completed',
        returnvalue: { ok: true },
      }),
    );

    expect(await getReportJobResult('rpt:x', 'doctor-1', 'patient-2')).toBeNull();
    expect(await getReportJobStatus('rpt:x', 'doctor-1', 'patient-2')).toBeNull();
    expect(await getReportJobStatus('rpt:x', 'doctor-1', 'patient-1')).toMatchObject({
      status: 'completed',
    });
  });
});

describe('closeReportQueue', () => {
  it('closes the shared queue and is safe when never used', async () => {
    await closeReportQueue(); // no-op path
    bullmq.setAdd(async () => ({ id: 'x', getState: async () => 'waiting' }));
    await submitReportJob('user-1', dailyParams);
    expect(bullmq.created).toHaveLength(1);
    await closeReportQueue();
    // After closing, the next use rebuilds the queue.
    await submitReportJob('user-1', dailyParams);
    expect(bullmq.created).toHaveLength(2);
  });
});
