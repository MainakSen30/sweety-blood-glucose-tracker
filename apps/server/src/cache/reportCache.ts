import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { getRedisClient, getRedisStatus, type RedisStatus } from './redisClient.js';

/**
 * Cache-aside report cache backed by Redis.
 *
 * - PostgreSQL is always the source of truth; a cache entry is only a copy of
 *   a report that PostgreSQL can reproduce.
 * - Every cache operation is best-effort: any Redis failure (read, write,
 *   invalidation, connection) is logged and counted, and the caller receives
 *   the PostgreSQL result as if the cache did not exist.
 * - Reports are serialized with JSON. Report DTOs contain only primitives,
 *   so the round-trip is lossless.
 */

const KEY_PREFIX = 'sweety:v2';
const USER_VERSION_PREFIX = `${KEY_PREFIX}:user-version`;

export type ReportType = 'daily' | 'month-to-date' | 'monthly';

/**
 * Every input that can change a report response, normalized. Dates are the
 * internal YYYY-MM-DD form the reporting service works with; the controller
 * validation has already converted and range-checked the DD-MM-YYYY query.
 */
export interface ReportCacheKeyParts {
  /** Patient whose readings the report is computed from. */
  userId: string;
  /**
   * Authenticated caller. Defaults to `userId` for a patient's own report;
   * a doctor's view is keyed separately even though it reads the same data.
   */
  requesterId?: string;
  reportType: ReportType;
  /** Daily and month-to-date reports are keyed by their reference date. */
  date?: string;
  /** Monthly reports are keyed by their computed period, so a Kolkata
   *  midnight rollover naturally produces a new key. */
  startDate?: string;
  endDate?: string;
}

/**
 * `sweety:v2:reports:r{requesterId}:u{userId}:v{version}:{type}:{period}`
 *
 * The requester is part of the key so patient, doctor, and different doctors'
 * views never share an entry. The version embeds the *patient's* invalidation
 * generation, so a reading mutation or consent revocation orphans every
 * cached view of that patient's reports (they expire within the TTL) without
 * any wildcard deletion or key enumeration.
 */
export function buildReportCacheKey(parts: ReportCacheKeyParts, version: number): string {
  const requester = `r${parts.requesterId ?? parts.userId}`;
  const owner = `u${parts.userId}:v${version}`;
  const period =
    parts.reportType === 'monthly'
      ? `${parts.startDate ?? ''}:${parts.endDate ?? ''}`
      : (parts.date ?? '');

  return `${KEY_PREFIX}:reports:${requester}:${owner}:${parts.reportType}:${period}`;
}

export function buildUserVersionKey(userId: string): string {
  return `${USER_VERSION_PREFIX}:u${userId}`;
}

export interface ReportCacheStats {
  hits: number;
  misses: number;
  errors: number;
}

export interface ReportCacheOptions {
  /** Shared Redis client, or `null` to disable caching entirely. */
  client: Redis | null;
  /** Expiration applied to every cached report, in seconds. */
  ttlSeconds: number;
}

export interface ReportCache {
  /** Monotonic counters for the health endpoint (never reset while running). */
  stats: ReportCacheStats;
  /** Current Redis status; always available even when caching is disabled. */
  redisStatus(): RedisStatus;
  /**
   * Cache-aside read: return the cached report for the key parts, or run the
   * loader against PostgreSQL, cache its result with the TTL, and return it.
   * Never rejects because of Redis problems.
   */
  getReport<T>(parts: ReportCacheKeyParts, loader: () => Promise<T>): Promise<T>;
  /**
   * Bumps the user's cache version after a successful reading mutation so
   * subsequent report reads miss the cache. Never rejects: a failed bump is
   * logged and leaves stale entries to expire within the TTL.
   */
  invalidateUser(userId: string): Promise<void>;
}

export function createReportCache({ client, ttlSeconds }: ReportCacheOptions): ReportCache {
  const stats: ReportCacheStats = { hits: 0, misses: 0, errors: 0 };

  function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async function readUserVersion(redis: Redis, userId: string): Promise<number> {
    const raw = await redis.get(buildUserVersionKey(userId));
    // No counter yet means nothing was invalidated for this user.
    return raw === null ? 0 : Number(raw);
  }

  return {
    stats,
    redisStatus() {
      return getRedisStatus();
    },

    async getReport(parts, loader) {
      if (!client) {
        return loader();
      }

      let key: string;
      try {
        const version = await readUserVersion(client, parts.userId);
        key = buildReportCacheKey(parts, version);

        const cached = await client.get(key);
        if (cached !== null) {
          stats.hits += 1;
          return JSON.parse(cached) as Awaited<ReturnType<typeof loader>>;
        }
        stats.misses += 1;
      } catch (error) {
        stats.errors += 1;
        console.error(
          `Redis cache read failed (${describeError(error)}); serving the report from PostgreSQL.`,
        );
        return loader();
      }

      const report = await loader();

      try {
        await client.set(key, JSON.stringify(report), 'EX', ttlSeconds);
      } catch (error) {
        // The report is still correct — only the optimization failed.
        stats.errors += 1;
        console.error(
          `Redis cache write failed (${describeError(error)}); report served uncached.`,
        );
      }

      return report;
    },

    async invalidateUser(userId) {
      if (!client) {
        return;
      }

      try {
        await client.incr(buildUserVersionKey(userId));
      } catch (error) {
        stats.errors += 1;
        console.error(
          `Redis cache invalidation failed (${describeError(error)}); ` +
            `stale reports may be served for this user for up to ${ttlSeconds} seconds.`,
        );
      }
    },
  };
}

/**
 * Application-wide cache instance: one client, one set of counters, the
 * configured TTL. `REDIS_URL` unset ⇒ `client: null` ⇒ caching disabled and
 * every report is computed against PostgreSQL directly.
 */
export const appReportCache = createReportCache({
  client: getRedisClient(),
  ttlSeconds: env.REDIS_CACHE_TTL_SECONDS,
});

/** Hook for the reading mutation services; never rejects. */
export async function invalidateUserReportCache(userId: string): Promise<void> {
  await appReportCache.invalidateUser(userId);
}
