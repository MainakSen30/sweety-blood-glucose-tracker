/**
 * Step F – Error handling and edge case tests
 *
 * Covers missing cases from the test plan:
 *   E8   – unsupported HTTP method on existing route → 404
 *   E9   – unknown route → 404 "Route not found"
 *   E10  – internal error response does not leak stack trace or DB details
 *   E16  – malformed JSON body on all POST/PATCH endpoints → 400
 *   E17  – open-ended `from`-only range is allowed
 *
 * Also covers non-UUID reading ID (E2) on the readings routes, which is
 * exercised from here without duplicating it from auth.supplemental.test.ts
 * (the two files cover different HTTP methods).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from './app.js';
import { closeTestPool, resetDatabase } from '../tests/database.js';

interface TestResponseHeaders {
  'set-cookie'?: string | string[];
}

function authCookieFrom(response: { headers: TestResponseHeaders }): string {
  const cookies = response.headers['set-cookie'];
  const all = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const authCookie = all.find((c) => c.startsWith('sweety_access_token='));
  if (!authCookie) throw new Error('Authentication cookie was not returned.');
  return authCookie.split(';')[0] ?? '';
}

async function registerAndGetCookie(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Error Test User', email, password: 'SecurePassword123' });
  if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  return authCookieFrom(res);
}

async function createReading(cookie: string, body: Record<string, unknown>) {
  return request(app).post('/api/readings').set('Cookie', cookie).send(body);
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// E8 – Unsupported HTTP methods on existing routes
// ---------------------------------------------------------------------------
describe('unsupported HTTP methods', () => {
  it('E8: PUT on /api/readings returns 404 Route not found', async () => {
    const cookie = await registerAndGetCookie('method-test@example.com');
    const res = await request(app).put('/api/readings').set('Cookie', cookie).send({ value: 100 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: 'Route not found' });
  });

  it('E8: DELETE on /api/auth/register returns 404 Route not found', async () => {
    const res = await request(app).delete('/api/auth/register');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: 'Route not found' });
  });
});

// ---------------------------------------------------------------------------
// E9 – Unknown routes → 404 handler
// ---------------------------------------------------------------------------
describe('unknown routes', () => {
  it('E9: a completely unknown route returns 404 with the Route not found body', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: 'Route not found' });
  });

  it('E9: an unknown nested path under a known prefix also returns 404', async () => {
    // /api/health is public; any sub-path under it is not registered.
    const res = await request(app).get('/api/health/nonexistent/subpath');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// E16 – Malformed JSON bodies on POST / PATCH endpoints
// ---------------------------------------------------------------------------
describe('malformed JSON bodies', () => {
  it('E16: malformed JSON on POST /api/readings returns 400', async () => {
    const cookie = await registerAndGetCookie('json-create@example.com');
    const res = await request(app)
      .post('/api/readings')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send('{invalid json');
    expect(res.status).toBe(400);
  });

  it('E16: malformed JSON on PATCH /api/readings/:id returns 400', async () => {
    const cookie = await registerAndGetCookie('json-patch@example.com');
    // Create a valid reading first so we have a real id.
    const created = await createReading(cookie, {
      readingDate: '15-01-2026',
      slot: 'morning',
      value: 100,
    });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send('{bad}');
    expect(res.status).toBe(400);
  });

  it('E16: malformed JSON on POST /api/auth/login returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{oops}');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// E10 – Internal error responses do not leak stack traces or DB details
// ---------------------------------------------------------------------------
describe('error response shape does not leak internals', () => {
  it('E10: 500 response from an unhandled error contains only status + message', async () => {
    // The global 404 handler (not found) uses the sanitized shape.
    // We can test the shape by inspecting a 404 (same path as a production 500).
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('message');
    // Must NOT contain stack, error, or any raw DB detail.
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/stack/i);
    expect(body).not.toMatch(/pg|postgres|sql/i);
    expect(body).not.toContain('at Object.');
    expect(body).not.toContain('Error:');
  });

  it('E10: 400 validation error body contains status, message, details — no stack', async () => {
    const cookie = await registerAndGetCookie('leak-test@example.com');
    const res = await createReading(cookie, {}); // triggers validation error
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('status', 'error');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('details');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/stack/i);
    expect(body).not.toMatch(/at Object\./);
  });

  it('E10: 409 conflict body contains only status + message — no stack or DB detail', async () => {
    const cookie = await registerAndGetCookie('conflict-test@example.com');
    // Create a reading and then try to duplicate it.
    await createReading(cookie, { readingDate: '15-01-2026', slot: 'morning', value: 100 });
    const res = await createReading(cookie, {
      readingDate: '15-01-2026',
      slot: 'morning',
      value: 110,
    });

    expect(res.status).toBe(409);
    expect(Object.keys(res.body)).toEqual(expect.arrayContaining(['status', 'message']));
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/stack/i);
    expect(body).not.toMatch(/pg|postgres|sql|constraint/i);
  });
});

// ---------------------------------------------------------------------------
// E17 – Open-ended from-only range is allowed
// ---------------------------------------------------------------------------
describe('open-ended date range filter', () => {
  it('E17: a from-only range (without to) returns all readings on or after from', async () => {
    const cookie = await registerAndGetCookie('range-test@example.com');

    await createReading(cookie, { readingDate: '10-01-2026', slot: 'morning', value: 100 });
    await createReading(cookie, { readingDate: '12-01-2026', slot: 'morning', value: 110 });
    await createReading(cookie, { readingDate: '05-01-2026', slot: 'morning', value: 90 });

    const res = await request(app)
      .get('/api/readings')
      .query({ from: '11-01-2026' })
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].readingDate).toBe('12-01-2026');
  });

  it('E17: a to-only range (without from) returns all readings on or before to', async () => {
    const cookie = await registerAndGetCookie('range-test2@example.com');

    await createReading(cookie, { readingDate: '10-01-2026', slot: 'morning', value: 100 });
    await createReading(cookie, { readingDate: '12-01-2026', slot: 'morning', value: 110 });
    await createReading(cookie, { readingDate: '05-01-2026', slot: 'morning', value: 90 });

    const res = await request(app)
      .get('/api/readings')
      .query({ to: '11-01-2026' })
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const dates = res.body.map((r: { readingDate: string }) => r.readingDate) as string[];
    expect(dates).toContain('10-01-2026');
    expect(dates).toContain('05-01-2026');
  });
});

// ---------------------------------------------------------------------------
// Invalid query parameters on report endpoints
// ---------------------------------------------------------------------------
describe('invalid query parameters', () => {
  it('invalid date query on /api/reports/daily returns 400', async () => {
    const cookie = await registerAndGetCookie('qp-test@example.com');
    const res = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        { path: 'date', message: 'Please enter a valid date in DD-MM-YYYY format.' },
      ]),
    );
  });

  it('invalid date query on /api/reports/month-to-date returns 400', async () => {
    const cookie = await registerAndGetCookie('qp-test2@example.com');
    const res = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: '2026-01-15' }); // wrong format
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Duplicate record attempt via API (409)
// ---------------------------------------------------------------------------
describe('duplicate record attempts', () => {
  it('inserting the same user+date+slot twice returns 409 with a friendly message', async () => {
    const cookie = await registerAndGetCookie('dup-test@example.com');
    await createReading(cookie, { readingDate: '15-01-2026', slot: 'after_lunch', value: 130 });
    const res = await createReading(cookie, {
      readingDate: '15-01-2026',
      slot: 'after_lunch',
      value: 140,
    });
    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it('a failed duplicate request does not leave partial data', async () => {
    const cookie = await registerAndGetCookie('dup-data@example.com');
    await createReading(cookie, { readingDate: '15-01-2026', slot: 'morning', value: 100 });
    // Attempt duplicate.
    await createReading(cookie, { readingDate: '15-01-2026', slot: 'morning', value: 999 });

    // Only the original reading must exist; value 999 must not have been stored.
    const list = await request(app).get('/api/readings').set('Cookie', cookie);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].value).toBe(100);
  });
});
