import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { closeTestPool, resetDatabase } from '../../../tests/database.js';
import { toDDMMYYYY, todayInAppTimezone } from '../../utils/date.js';
import { previousMonthRange } from './reports.service.js';
import * as readingsRepository from '../readings/readings.repository.js';
import * as reportsRepository from './reports.repository.js';

/**
 * Report caching exercised through the real application (routing, auth,
 * validation, PostgreSQL) with only the Redis client seam replaced by an
 * in-memory double. Proves end-user-visible behaviour: hits skip the report
 * query, mutations invalidate, failures fall back to PostgreSQL.
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

vi.mock('../../cache/redisClient.js', () => ({
  getRedisClient: () => fake.client,
  getRedisStatus: () => (fake.client.status === 'ready' ? 'ready' : 'down'),
  createRedisClient: vi.fn(),
  closeRedis: vi.fn(async () => undefined),
}));

// Spies around the real repository functions so PostgreSQL behaviour stays
// intact while call counts prove that caching avoids repeated queries.
vi.mock('../readings/readings.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../readings/readings.repository.js')>();
  return {
    ...actual,
    listReadings: vi.fn((...args: Parameters<typeof actual.listReadings>) =>
      actual.listReadings(...args),
    ),
  };
});

vi.mock('./reports.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reports.repository.js')>();
  return {
    ...actual,
    aggregateUserReadings: vi.fn((...args: Parameters<typeof actual.aggregateUserReadings>) =>
      actual.aggregateUserReadings(...args),
    ),
  };
});

const listReadingsSpy = vi.mocked(readingsRepository.listReadings);
const aggregateSpy = vi.mocked(reportsRepository.aggregateUserReadings);

beforeEach(async () => {
  vi.clearAllMocks();
  fake.store.clear();
  fake.client.status = 'ready';
  fake.client.get
    .mockClear()
    .mockImplementation(async (key: string) => fake.store.get(key) ?? null);
  fake.client.set.mockClear().mockImplementation(async (key: string, value: string) => {
    fake.store.set(key, value);
  });
  fake.client.incr.mockClear().mockImplementation(async (key: string) => {
    const next = Number(fake.store.get(key) ?? 0) + 1;
    fake.store.set(key, String(next));
    return next;
  });

  await resetDatabase();
});

async function registerUser(email: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Cache User', email, password: 'SecurePassword123' });

  expect(response.status).toBe(201);
  const cookies = response.headers['set-cookie'] as unknown as string[];
  return cookies[0]!.split(';')[0]!;
}

async function createReading(
  cookie: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app).post('/api/readings').set('Cookie', cookie).send(body);
}

const REPORT_DATE = '15-01-2026';
const REPORT_DATE_ISO = '2026-01-15';

describe('report caching through the API', () => {
  it('computes the daily report once and serves the second request from the cache', async () => {
    const cookie = await registerUser('cache-hit@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    const first = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.summary.totalReadings).toBe(1);

    const listCallsAfterFirst = listReadingsSpy.mock.calls.length;

    const second = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(listReadingsSpy.mock.calls.length).toBe(listCallsAfterFirst);
  });

  it('keys different report types and parameters independently', async () => {
    const cookie = await registerUser('cache-keys@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 110 });

    const daily = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    const dailyOther = await request(app)
      .get('/api/reports/daily?date=16-01-2026')
      .set('Cookie', cookie);

    expect(daily.body.summary.totalReadings).toBe(1);
    expect(dailyOther.body.summary.totalReadings).toBe(0);
    // Two different keys: both requests computed against PostgreSQL.
    expect(listReadingsSpy.mock.calls.length).toBe(2);

    // Repeating both now hits the cache.
    await request(app).get(`/api/reports/daily?date=${REPORT_DATE}`).set('Cookie', cookie);
    await request(app).get('/api/reports/daily?date=16-01-2026').set('Cookie', cookie);
    expect(listReadingsSpy.mock.calls.length).toBe(2);
  });

  it('never serves user B the cached report of user A', async () => {
    const cookieA = await registerUser('cache-user-a@example.com');
    const cookieB = await registerUser('cache-user-b@example.com');
    await createReading(cookieA, { readingDate: REPORT_DATE, slot: 'morning', value: 150 });

    const reportA = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookieA);
    expect(reportA.body.summary.totalReadings).toBe(1);

    const reportB = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookieB);

    expect(reportB.body.summary.totalReadings).toBe(0);
    expect(reportB.body).toEqual({
      reportType: 'daily',
      date: REPORT_DATE,
      summary: { highest: null, lowest: null, average: null, totalReadings: 0 },
      readings: [],
    });
    // The cache was keyed with each caller's authenticated user id.
    const cachedKeys = [...fake.store.keys()].filter((key) => key.includes(':reports:'));
    expect(cachedKeys.some((key) => key.startsWith('sweety:v2:reports:r'))).toBe(true);
    expect(cachedKeys.every((key) => /:reports:r[^:]+:u[^:]+:v\d+:/.test(key))).toBe(true);
  });
});

describe('invalidation through reading mutations', () => {
  it('reflects a created reading immediately (cache invalidated)', async () => {
    const cookie = await registerUser('cache-create@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    const first = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(first.body.summary.totalReadings).toBe(1);

    // The mutation must invalidate the cached report.
    await createReading(cookie, {
      readingDate: REPORT_DATE,
      slot: 'after_breakfast',
      value: 140,
    });

    const second = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(second.body.summary.totalReadings).toBe(2);
    expect(second.body.summary.highest).toBe(140);
  });

  it('reflects an updated value immediately', async () => {
    const cookie = await registerUser('cache-update@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    const cached = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(cached.body.summary.average).toBe(100);

    const readingId = cached.body.readings[0].id as string;
    const update = await request(app)
      .patch(`/api/readings/${readingId}`)
      .set('Cookie', cookie)
      .send({ value: 175 });
    expect(update.status).toBe(200);

    const fresh = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(fresh.body.summary.average).toBe(175);
  });

  it('reflects a deletion immediately', async () => {
    const cookie = await registerUser('cache-delete@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'after_lunch', value: 160 });

    const cached = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(cached.body.summary.totalReadings).toBe(2);

    const deleteResponse = await request(app)
      .delete(`/api/readings/${cached.body.readings[0].id}`)
      .set('Cookie', cookie);
    expect(deleteResponse.status).toBe(200);

    const fresh = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(fresh.body.summary.totalReadings).toBe(1);
  });

  it('keeps the cached report usable when a mutation fails', async () => {
    const cookie = await registerUser('cache-failed@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    const cached = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(cached.body.summary.totalReadings).toBe(1);
    const listCallsAfterCache = listReadingsSpy.mock.calls.length;

    // Duplicate slot on the same date → 409, mutation rolled back.
    const conflict = await createReading(cookie, {
      readingDate: REPORT_DATE,
      slot: 'morning',
      value: 200,
    });
    expect(conflict.status).toBe(409);

    // The cache entry is still valid: no new PostgreSQL query runs.
    const after = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(after.body).toEqual(cached.body);
    expect(listReadingsSpy.mock.calls.length).toBe(listCallsAfterCache);
  });

  it('invalidates only the mutating user', async () => {
    const cookieA = await registerUser('cache-iso-a@example.com');
    const cookieB = await registerUser('cache-iso-b@example.com');
    await createReading(cookieA, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    await request(app).get(`/api/reports/daily?date=${REPORT_DATE}`).set('Cookie', cookieA);
    const reportB = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookieB);
    expect(reportB.body.summary.totalReadings).toBe(0);

    // A mutates; B's cache entry must remain valid.
    await createReading(cookieA, { readingDate: REPORT_DATE, slot: 'after_lunch', value: 130 });

    const reportBAgain = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookieB);
    expect(reportBAgain.body).toEqual(reportB.body);

    const listCallsBefore = listReadingsSpy.mock.calls.length;
    const reportAAgain = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookieA);
    expect(reportAAgain.body.summary.totalReadings).toBe(2);
    expect(listReadingsSpy.mock.calls.length).toBe(listCallsBefore + 1);
  });

  it('invalidates period reports (month-to-date and previous month) after a mutation', async () => {
    const cookie = await registerUser('cache-periods@example.com');
    const todayIso = todayInAppTimezone();
    const todayApi = toDDMMYYYY(todayIso);

    const first = await request(app)
      .get(`/api/reports/month-to-date?date=${todayApi}`)
      .set('Cookie', cookie);
    expect(first.status).toBe(200);
    const aggregateCallsAfterFirst = aggregateSpy.mock.calls.length;

    await request(app).get(`/api/reports/month-to-date?date=${todayApi}`).set('Cookie', cookie);
    expect(aggregateSpy.mock.calls.length).toBe(aggregateCallsAfterFirst);

    // A mutation in the current month must refresh the period report.
    await createReading(cookie, { readingDate: todayApi, slot: 'morning', value: 120 });

    const third = await request(app)
      .get(`/api/reports/month-to-date?date=${todayApi}`)
      .set('Cookie', cookie);
    expect(third.body.summary.totalReadings).toBe(1);
    expect(third.body.period.startDate).toBe(toDDMMYYYY(`${todayIso.slice(0, 7)}-01`));

    // Previous-month report: seeded reading in the previous month.
    const previousPeriod = previousMonthRange(todayIso);
    const previousApi = toDDMMYYYY(previousPeriod.startDate);
    const previousFirst = await request(app).get('/api/reports/monthly').set('Cookie', cookie);
    expect(previousFirst.status).toBe(200);

    await createReading(cookie, { readingDate: previousApi, slot: 'after_dinner', value: 99 });
    const previousSecond = await request(app).get('/api/reports/monthly').set('Cookie', cookie);
    expect(previousSecond.body.summary.totalReadings).toBe(1);
    expect(previousSecond.body.period.endDate).toBe(toDDMMYYYY(previousPeriod.endDate));
  });
});

describe('Redis failures fall back to PostgreSQL', () => {
  it('serves a correct report when Redis reads fail', async () => {
    const cookie = await registerUser('cache-readfail@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    fake.client.get.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalReadings).toBe(1);
  });

  it('serves a correct report and recomputes later when Redis writes fail', async () => {
    const cookie = await registerUser('cache-writefail@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    fake.client.set.mockRejectedValueOnce(new Error('OOM command not allowed'));

    const first = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.summary.totalReadings).toBe(1);

    const listCallsAfterFirst = listReadingsSpy.mock.calls.length;
    const second = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(second.body).toEqual(first.body);
    // The write failed, so nothing was cached and the query ran again.
    expect(listReadingsSpy.mock.calls.length).toBe(listCallsAfterFirst + 1);
  });

  it('never blocks a successful mutation on a failing Redis invalidation', async () => {
    const cookie = await registerUser('cache-incrfail@example.com');

    // Simulates Redis flapping during the mutation.
    fake.client.incr.mockRejectedValueOnce(new Error('Redis is loading the dataset in memory'));

    const created = await createReading(cookie, {
      readingDate: REPORT_DATE,
      slot: 'morning',
      value: 100,
    });

    expect(created.status).toBe(201);
    expect(created.body.value).toBe(100);
  });

  it('serves fresh data when Redis is fully unavailable during a mutation', async () => {
    const cookie = await registerUser('cache-outage@example.com');
    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'morning', value: 100 });

    const cached = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(cached.body.summary.totalReadings).toBe(1);

    // Total outage: every Redis operation now fails.
    fake.client.status = 'down';
    fake.client.get.mockRejectedValue(new Error('Connection closed'));
    fake.client.set.mockRejectedValue(new Error('Connection closed'));
    fake.client.incr.mockRejectedValue(new Error('Connection closed'));

    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'after_lunch', value: 150 });

    // Reads also fail while Redis is down, so PostgreSQL serves fresh data.
    const fresh = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(fresh.status).toBe(200);
    expect(fresh.body.summary.totalReadings).toBe(2);

    // Recovery: Redis is available again. The entry cached before the outage
    // resurfaces: the failed invalidation could not bump the version, so
    // staleness is bounded by the TTL (60s) and self-corrects. The next
    // successful mutation re-invalidates and freshness resumes immediately.
    fake.client.status = 'ready';
    fake.client.get.mockImplementation(async (key: string) => fake.store.get(key) ?? null);
    fake.client.set.mockImplementation(async (key: string, value: string) => {
      fake.store.set(key, value);
    });
    fake.client.incr.mockImplementation(async (key: string) => {
      const next = Number(fake.store.get(key) ?? 0) + 1;
      fake.store.set(key, String(next));
      return next;
    });

    const recovered = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(recovered.status).toBe(200);
    expect(recovered.body.summary.totalReadings).toBe(1);

    await createReading(cookie, { readingDate: REPORT_DATE, slot: 'after_dinner', value: 175 });
    const refreshed = await request(app)
      .get(`/api/reports/daily?date=${REPORT_DATE}`)
      .set('Cookie', cookie);
    expect(refreshed.body.summary.totalReadings).toBe(3);
  });

  it('reports cache observability on the health endpoint without affecting liveness', async () => {
    const cookie = await registerUser('cache-health@example.com');
    await request(app).get(`/api/reports/daily?date=${REPORT_DATE}`).set('Cookie', cookie);
    await request(app).get(`/api/reports/daily?date=${REPORT_DATE}`).set('Cookie', cookie);

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(health.body.cache.redis).toBe('ready');
    expect(health.body.cache.hits).toBeGreaterThan(0);
    expect(health.body.cache.misses).toBeGreaterThan(0);
    expect(health.body.cache).not.toHaveProperty('keys');
  });

  it('serves the identical ISO date key for the same query date', async () => {
    const cookie = await registerUser('cache-normalize@example.com');

    await request(app).get(`/api/reports/daily?date=${REPORT_DATE}`).set('Cookie', cookie);

    const cachedKeys = [...fake.store.keys()].filter((key) =>
      key.includes(`daily:${REPORT_DATE_ISO}`),
    );
    expect(cachedKeys).toHaveLength(1);
  });
});

afterAll(async () => {
  await closeTestPool();
});
