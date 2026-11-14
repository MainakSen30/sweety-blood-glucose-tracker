import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import {
  buildReportCacheKey,
  buildUserVersionKey,
  createReportCache,
  type ReportCache,
} from './reportCache.js';

/**
 * Minimal Redis test double: a string/byte store with get/set/incr, plus a
 * per-operation failure switch so Redis outages can be simulated
 * deterministically without a real server.
 */
class FakeRedis {
  store = new Map<string, string>();
  calls: Array<{ op: string; args: unknown[] }> = [];
  failOperations = new Set<string>();

  private record(op: string, args: unknown[]) {
    this.calls.push({ op, args });
    if (this.failOperations.has(op)) {
      throw new Error(`simulated ${op} failure`);
    }
  }

  async get(key: string): Promise<string | null> {
    this.record('get', [key]);
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _mode: 'EX', _ttl: number): Promise<void> {
    this.record('set', [key, value, _mode, _ttl]);
    this.store.set(key, value);
  }

  async incr(key: string): Promise<number> {
    this.record('incr', [key]);
    const next = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(next));
    return next;
  }
}

type Parts = Parameters<ReportCache['getReport']>[0];

function dailyParts(userId: string): Parts {
  return { userId, reportType: 'daily', date: '2026-01-15' };
}

function makeCache(client: FakeRedis | null, ttlSeconds = 60): ReportCache {
  return createReportCache({ client: client as unknown as Redis, ttlSeconds });
}

describe('buildReportCacheKey', () => {
  it('is namespaced, versioned, user-specific, and type-specific', () => {
    expect(
      buildReportCacheKey({ userId: 'user-1', reportType: 'daily', date: '2026-01-15' }, 3),
    ).toBe('sweety:v1:reports:uuser-1:v3:daily:2026-01-15');
    expect(
      buildReportCacheKey({ userId: 'user-1', reportType: 'month-to-date', date: '2026-01-15' }, 0),
    ).toBe('sweety:v1:reports:uuser-1:v0:month-to-date:2026-01-15');
    expect(
      buildReportCacheKey(
        { userId: 'user-1', reportType: 'monthly', startDate: '2025-12-01', endDate: '2025-12-31' },
        0,
      ),
    ).toBe('sweety:v1:reports:uuser-1:v0:monthly:2025-12-01:2025-12-31');
  });

  it('never lets two users share a key, and versions invalidate keys', () => {
    const userA = buildReportCacheKey(dailyParts('user-1'), 0);
    const userB = buildReportCacheKey({ ...dailyParts('user-2') }, 0);
    expect(userA).not.toBe(userB);

    const bumped = buildReportCacheKey(dailyParts('user-1'), 1);
    expect(bumped).not.toBe(userA);
  });
});

describe('createReportCache — cache-aside reads', () => {
  it('runs the loader on a miss and caches the result with the configured TTL', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loader = vi.fn().mockResolvedValue({ summary: { totalReadings: 1 } });

    const report = await cache.getReport(dailyParts('user-1'), loader);

    expect(report).toEqual({ summary: { totalReadings: 1 } });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.stats.misses).toBe(1);

    const setCall = redis.calls.find((call) => call.op === 'set');
    expect(setCall?.args[0]).toBe(buildReportCacheKey(dailyParts('user-1'), 0));
    expect(setCall?.args[2]).toBe('EX');
    expect(setCall?.args[3]).toBe(60);
  });

  it('serves a cache hit without running the loader again', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loader = vi.fn().mockResolvedValue({ value: 'from-postgres' });

    await cache.getReport(dailyParts('user-1'), loader);
    const second = await cache.getReport(dailyParts('user-1'), loader);

    expect(second).toEqual({ value: 'from-postgres' });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.stats.hits).toBe(1);
  });

  it('keys different report parameters independently', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loaderFor = (value: string) => vi.fn().mockResolvedValue({ value });

    const daily = await cache.getReport(dailyParts('user-1'), loaderFor('daily-report'));
    const monthly = await cache.getReport(
      { userId: 'user-1', reportType: 'monthly', startDate: '2025-12-01', endDate: '2025-12-31' },
      loaderFor('monthly-report'),
    );

    expect(daily).toEqual({ value: 'daily-report' });
    expect(monthly).toEqual({ value: 'monthly-report' });
    expect(redis.store.size).toBe(2);
  });

  it('applies a custom TTL to every cached entry', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis, 120);
    const loader = vi.fn().mockResolvedValue({ value: 1 });

    await cache.getReport(dailyParts('user-1'), loader);
    await cache.invalidateUser('user-1');
    await cache.getReport(dailyParts('user-1'), loader);

    const setCalls = redis.calls.filter((call) => call.op === 'set');
    expect(setCalls).toHaveLength(2);
    expect(setCalls.every((call) => call.args[2] === 'EX' && call.args[3] === 120)).toBe(true);
  });

  it('never caches when the client is absent (caching disabled)', async () => {
    const cache = makeCache(null);
    const loader = vi.fn().mockResolvedValue({ value: 'postgres' });

    expect(await cache.getReport(dailyParts('user-1'), loader)).toEqual({ value: 'postgres' });
    expect(await cache.getReport(dailyParts('user-1'), loader)).toEqual({ value: 'postgres' });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(cache.stats).toEqual({ hits: 0, misses: 0, errors: 0 });
  });
});

describe('createReportCache — user-scoped invalidation', () => {
  it('bumps the user version so the next read misses and repopulates', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ version: 'before-mutation' })
      .mockResolvedValueOnce({ version: 'after-mutation' });

    await cache.getReport(dailyParts('user-1'), loader);
    await cache.invalidateUser('user-1');
    const after = await cache.getReport(dailyParts('user-1'), loader);

    expect(after).toEqual({ version: 'after-mutation' });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(redis.store.get(buildUserVersionKey('user-1'))).toBe('1');
  });

  it('only invalidates the mutating user', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loaderA = vi.fn().mockResolvedValue({ user: 'a' });
    const loaderB = vi.fn().mockResolvedValue({ user: 'b' });

    await cache.getReport(dailyParts('user-1'), loaderA);
    await cache.getReport(dailyParts('user-2'), loaderB);

    await cache.invalidateUser('user-1');

    // User B's cached report survives the unrelated mutation.
    const loaderB2 = vi.fn().mockResolvedValue({ user: 'b' });
    expect(await cache.getReport(dailyParts('user-2'), loaderB2)).toEqual({ user: 'b' });
    expect(loaderB2).not.toHaveBeenCalled();
  });
});

describe('createReportCache — Redis failures degrade to PostgreSQL', () => {
  it('serves the loader result when a cache read fails', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loader = vi.fn().mockResolvedValue({ value: 'postgres' });
    redis.failOperations.add('get');

    expect(await cache.getReport(dailyParts('user-1'), loader)).toEqual({ value: 'postgres' });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.stats.errors).toBe(1);
    expect(cache.stats.misses).toBe(0);
  });

  it('returns the loader result when a cache write fails', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loader = vi.fn().mockResolvedValue({ value: 'postgres' });
    redis.failOperations.add('set');

    expect(await cache.getReport(dailyParts('user-1'), loader)).toEqual({ value: 'postgres' });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.stats.errors).toBe(1);
    // Nothing was cached, so the next request recomputes.
    await cache.getReport(dailyParts('user-1'), loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('treats invalidation failure as non-fatal and bounded by the TTL', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis, 60);
    redis.failOperations.add('incr');

    await expect(cache.invalidateUser('user-1')).resolves.toBeUndefined();
    expect(cache.stats.errors).toBe(1);
    // The old version key is untouched: stale entries can be served for at
    // most the TTL after a failed bump.
    expect(redis.store.has(buildUserVersionKey('user-1'))).toBe(false);
  });
});

describe('createReportCache — stats', () => {
  it('counts hits, misses, and errors independently', async () => {
    const redis = new FakeRedis();
    const cache = makeCache(redis);
    const loader = vi.fn().mockResolvedValue({ value: 1 });

    await cache.getReport(dailyParts('user-1'), loader); // miss
    await cache.getReport(dailyParts('user-1'), loader); // hit
    await cache.getReport(dailyParts('user-2'), loader); // miss

    redis.failOperations.add('get');
    await cache.getReport(dailyParts('user-3'), loader); // read error

    expect(cache.stats).toEqual({ hits: 1, misses: 2, errors: 1 });
  });
});
