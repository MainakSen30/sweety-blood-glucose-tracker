import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/**
 * Redis connection lifecycle for the disposable report cache.
 *
 * PostgreSQL remains the source of truth; Redis is a performance
 * optimization only. The client is created once and reused for every
 * request. With `REDIS_URL` unset the client is `null` and caching is
 * disabled — every cache operation degrades to a direct PostgreSQL read.
 *
 * Connection settings favour failing fast over hanging:
 * - `lazyConnect` defers the TCP connection until the first command.
 * - `enableOfflineQueue: false` rejects commands issued while disconnected
 *   instead of queueing them (the cache treats a rejection as a cache miss).
 * - `commandTimeout` bounds every individual command.
 * - `retryStrategy` caps reconnection backoff so an outage cannot spiral
 *   into a tight reconnect loop; the client keeps trying and recovers on its
 *   own once Redis is reachable again.
 */
const CONNECT_TIMEOUT_MS = 3_000;
const COMMAND_TIMEOUT_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 3_000;

let client: Redis | null = null;

export type RedisStatus = 'disabled' | 'connecting' | 'ready' | 'down';

export function createRedisClient(url: string): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: CONNECT_TIMEOUT_MS,
    commandTimeout: COMMAND_TIMEOUT_MS,
    retryStrategy: (attempt: number) => Math.min(attempt * 500, MAX_RECONNECT_DELAY_MS),
    // Keep credentials out of any output the client itself produces.
    showFriendlyErrorStack: false,
  });

  redis.on('error', (error: Error) => {
    // Logged, never fatal: the application keeps serving reports from
    // PostgreSQL whenever Redis is unreachable.
    console.error('Redis cache error:', error.message);
  });
  redis.on('connect', () => console.log('Redis cache connected.'));
  redis.on('end', () => console.log('Redis cache connection closed.'));

  return redis;
}

/** Returns the shared client, or `null` when caching is disabled. */
export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  client ??= createRedisClient(env.REDIS_URL);
  return client;
}

/** Non-sensitive status for the health endpoint. */
export function getRedisStatus(): RedisStatus {
  if (!env.REDIS_URL) {
    return 'disabled';
  }

  const redis = getRedisClient();
  if (!redis || redis.status === 'end') {
    return 'down';
  }
  if (redis.status === 'ready') {
    return 'ready';
  }
  return 'connecting';
}

/** Closes the shared client during graceful server shutdown. */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}
