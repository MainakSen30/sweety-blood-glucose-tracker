import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_ERROR_BODY, createAuthRateLimiter } from './rate-limit.js';

describe('createAuthRateLimiter', () => {
  it('allows requests below the limit and returns a consistent JSON 429 beyond it', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/login',
      createAuthRateLimiter({ windowMs: 60_000, max: 2 }),
      (_request, response) => {
        response.status(200).json({ status: 'ok' });
      },
    );

    const first = await request(app).post('/login').send({});
    const second = await request(app).post('/login').send({});
    const third = await request(app).post('/login').send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect(third.status).toBe(429);
    expect(third.body).toEqual(RATE_LIMIT_ERROR_BODY);
    expect(third.body).toEqual({
      status: 'error',
      message: 'Too many requests. Please try again later.',
    });
    expect(third.headers['ratelimit']).toBeDefined();
    expect(third.headers['ratelimit-policy']).toBeDefined();
  });

  it('does not count requests when skipped', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/login',
      createAuthRateLimiter({ windowMs: 60_000, max: 1, skip: () => true }),
      (_request, response) => {
        response.status(200).json({ status: 'ok' });
      },
    );

    const first = await request(app).post('/login').send({});
    const second = await request(app).post('/login').send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
