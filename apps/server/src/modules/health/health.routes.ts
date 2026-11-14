import { Router } from 'express';
import { appReportCache } from '../../cache/reportCache.js';
import { getRedisStatus } from '../../cache/redisClient.js';

export const healthRouter = Router();

/**
 * Liveness stays app-level: the API is "ok" while it can serve requests.
 * Redis is reported informationally — a cache outage never turns a working,
 * PostgreSQL-backed API into an unhealthy one.
 */
healthRouter.get('/', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    message: 'Sweety API is running',
    cache: {
      redis: getRedisStatus(),
      ...appReportCache.stats,
    },
  });
});
