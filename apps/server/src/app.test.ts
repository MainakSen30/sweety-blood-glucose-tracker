import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from './app.js';

describe('GET /api/health', () => {
  it('returns an ok response indicating the API is running', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.message).toBe('Sweety API is running');
    // Caching is disabled without REDIS_URL: reports always come from
    // PostgreSQL, and Redis status is informational only.
    expect(response.body.cache).toEqual({
      redis: 'disabled',
      hits: expect.any(Number),
      misses: expect.any(Number),
      errors: expect.any(Number),
    });
  });
});
