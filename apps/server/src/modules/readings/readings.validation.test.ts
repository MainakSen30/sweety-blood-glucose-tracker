/**
 * Step C – Validation tests (supplemental)
 *
 * Covers missing cases from the test plan:
 *   A1-1, A1-2, A1-5, A1-6, A1-8, A1-9   – glucose value boundaries / types
 *   A2-2, A2-6, A2-7                       – date edge cases
 *   A3-3                                   – missing slot
 *   A4-4, A4-5                             – daily limit: delete-then-add, update no recount
 *   A5-1, A5-2, A5-3, A5-4                 – payload validation
 *
 * All cases use the API layer (Supertest) so the full Zod → route → handler
 * pipeline is exercised exactly as in production.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { closeTestPool, resetDatabase } from '../../../tests/database.js';
import { toDDMMYYYY, todayInAppTimezone } from '../../utils/date.js';

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

async function registerTestUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password: 'SecurePassword123' });
  expect(res.status).toBe(201);
  return authCookieFrom(res);
}

async function createReading(cookie: string, body: Record<string, unknown>) {
  return request(app).post('/api/readings').set('Cookie', cookie).send(body);
}

// A fixed past date that never crosses the future-date guard.
const PAST_DATE = '15-01-2026';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// A1 – Glucose value boundaries
// ---------------------------------------------------------------------------
describe('glucose value boundaries', () => {
  it('A1-1: accepts the minimum boundary value 40', async () => {
    const cookie = await registerTestUser('val-min@example.com');
    const res = await createReading(cookie, { readingDate: PAST_DATE, slot: 'morning', value: 40 });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe(40);
  });

  it('A1-2: accepts the maximum boundary value 600', async () => {
    const cookie = await registerTestUser('val-max@example.com');
    const res = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 600,
    });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe(600);
  });

  it('A1-5: rejects zero', async () => {
    const cookie = await registerTestUser('val-zero@example.com');
    const res = await createReading(cookie, { readingDate: PAST_DATE, slot: 'morning', value: 0 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { path: 'value', message: 'Value must be between 40 and 600 mg/dl.' },
    ]);
  });

  it('A1-6: rejects a negative value', async () => {
    const cookie = await registerTestUser('val-neg@example.com');
    const res = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: -10,
    });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { path: 'value', message: 'Value must be between 40 and 600 mg/dl.' },
    ]);
  });

  it('A1-8: rejects a string value', async () => {
    const cookie = await registerTestUser('val-str@example.com');
    const res = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 'abc',
    });
    expect(res.status).toBe(400);
    // Zod reports the value field as invalid; message comes from valueSchema error option.
    expect(res.body.details.some((d: { path: string }) => d.path === 'value')).toBe(true);
  });

  it('A1-9: rejects a null value', async () => {
    const cookie = await registerTestUser('val-null@example.com');
    const res = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: null,
    });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d: { path: string }) => d.path === 'value')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A2 – Date validation
// ---------------------------------------------------------------------------
describe('date validation', () => {
  it('A2-2: accepts today as a valid readingDate', async () => {
    const cookie = await registerTestUser('date-today@example.com');
    const today = toDDMMYYYY(todayInAppTimezone());
    const res = await createReading(cookie, { readingDate: today, slot: 'morning', value: 100 });
    expect(res.status).toBe(201);
    expect(res.body.readingDate).toBe(today);
  });

  it('A2-6: rejects a completely non-date string', async () => {
    const cookie = await registerTestUser('date-bad@example.com');
    const res = await createReading(cookie, {
      readingDate: 'not-a-date',
      slot: 'morning',
      value: 100,
    });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { path: 'readingDate', message: 'Please enter a valid date in DD-MM-YYYY format.' },
    ]);
  });

  it('A2-7: rejects a missing readingDate field', async () => {
    const cookie = await registerTestUser('date-missing@example.com');
    const res = await createReading(cookie, { slot: 'morning', value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d: { path: string }) => d.path === 'readingDate')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A3 – Slot validation
// ---------------------------------------------------------------------------
describe('slot validation', () => {
  it('A3-3: rejects a missing slot field', async () => {
    const cookie = await registerTestUser('slot-missing@example.com');
    const res = await createReading(cookie, { readingDate: PAST_DATE, value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d: { path: string }) => d.path === 'slot')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A4 – Daily reading limit
// ---------------------------------------------------------------------------
describe('daily reading limit edge cases', () => {
  it('A4-4: deleting a reading and then adding another stays within the daily limit', async () => {
    const cookie = await registerTestUser('limit-delete@example.com');

    // Fill all 4 slots.
    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      const r = await createReading(cookie, { readingDate: PAST_DATE, slot, value: 100 });
      expect(r.status).toBe(201);
    }

    // Delete the morning reading; daily count drops back to 3.
    const list = await request(app).get('/api/readings').set('Cookie', cookie);
    const morningId = list.body.find((r: { slot: string }) => r.slot === 'morning').id as string;
    const del = await request(app).delete(`/api/readings/${morningId}`).set('Cookie', cookie);
    expect(del.status).toBe(200);

    // Now adding a new morning reading should succeed because the day only has 3.
    const after = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 110,
    });
    expect(after.status).toBe(201);
  });

  it('A4-5: updating an existing reading does not inflate the daily count', async () => {
    const cookie = await registerTestUser('limit-update@example.com');

    // Create exactly 4 readings (the daily maximum).
    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      await createReading(cookie, { readingDate: PAST_DATE, slot, value: 100 });
    }

    // Retrieve the morning reading id.
    const list = await request(app).get('/api/readings').set('Cookie', cookie);
    const morningId = list.body.find((r: { slot: string }) => r.slot === 'morning').id as string;

    // Update the value only (same date, same slot) — must NOT be treated as a 5th reading.
    const patch = await request(app)
      .patch(`/api/readings/${morningId}`)
      .set('Cookie', cookie)
      .send({ value: 150 });

    // The update should succeed; a 409 would mean the service incorrectly
    // counted the existing reading as an extra one.
    expect(patch.status).toBe(200);
    expect(patch.body.value).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// A5 – Payload / body validation
// ---------------------------------------------------------------------------
describe('payload validation', () => {
  it('A5-1: rejects a completely empty body on create', async () => {
    const cookie = await registerTestUser('payload-empty@example.com');
    const res = await createReading(cookie, {});
    expect(res.status).toBe(400);
    // All three required fields should be reported as missing.
    const paths = res.body.details.map((d: { path: string }) => d.path) as string[];
    expect(paths).toContain('readingDate');
    expect(paths).toContain('slot');
    expect(paths).toContain('value');
  });

  it('A5-2: extra properties are ignored (Zod strips unknowns)', async () => {
    const cookie = await registerTestUser('payload-extra@example.com');
    const res = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 100,
      unexpectedField: 'should be ignored',
    });
    expect(res.status).toBe(201);
    // The extra field must not leak back in the response.
    expect(res.body).not.toHaveProperty('unexpectedField');
  });

  it('A5-3: malformed JSON body returns 400 on create', async () => {
    const cookie = await registerTestUser('payload-json@example.com');
    const res = await request(app)
      .post('/api/readings')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send('{bad json}');
    // Express JSON parser returns 400 for unparseable bodies.
    expect(res.status).toBe(400);
  });

  it('A5-4: missing Content-Type with no body returns 400', async () => {
    const cookie = await registerTestUser('payload-ct@example.com');
    // Sending without Content-Type; Express treats the body as empty/undefined.
    const res = await request(app)
      .post('/api/readings')
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain')
      .send('{}');
    // The route handler receives an empty body or non-JSON body; validation fails.
    expect(res.status).toBe(400);
  });
});
