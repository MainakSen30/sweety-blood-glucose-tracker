import rateLimit, { type Options } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

/**
 * JSON error body returned when a rate limit is exceeded. The shape matches
 * the application's other error responses ({ status, message }) so clients can
 * handle it the same way.
 */
export const RATE_LIMIT_ERROR_BODY = {
  status: 'error',
  message: 'Too many requests. Please try again later.',
} as const;

interface AuthRateLimiterOverrides {
  windowMs?: number;
  max?: number;
  skip?: Options['skip'];
}

/**
 * Factory for the authentication rate limiter so tests can exercise the 429
 * behavior with small values. Production uses `authRateLimiter` below, which
 * is configured from environment variables and disabled while tests run.
 */
export function createAuthRateLimiter(overrides: AuthRateLimiterOverrides = {}): RequestHandler {
  return rateLimit({
    windowMs: overrides.windowMs ?? env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: overrides.max ?? env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: overrides.skip,
    message: RATE_LIMIT_ERROR_BODY,
  });
}

/**
 * Rate limiter for POST /api/auth/register and POST /api/auth/login.
 *
 * Defaults: 20 requests per 15 minutes per IP, configurable through
 * AUTH_RATE_LIMIT_MAX and AUTH_RATE_LIMIT_WINDOW_MS. It is skipped while
 * NODE_ENV=test so the integration tests (which share a single supertest IP
 * across many requests) stay deterministic.
 *
 * The limiter keeps its counters in process memory, which is appropriate for
 * this single-instance assignment deployment. If the API is ever scaled to
 * multiple instances or restarts frequently, a shared store (for example
 * Redis) would be required for consistent limits.
 */
export const authRateLimiter = createAuthRateLimiter({
  skip: () => env.NODE_ENV === 'test',
});
