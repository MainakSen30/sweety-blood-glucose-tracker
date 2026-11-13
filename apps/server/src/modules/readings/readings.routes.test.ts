import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { db } from '../../database/index.js';
import { readings } from '../../database/schema.js';
import { closeTestPool, getTestPool, resetDatabase } from '../../../tests/database.js';
import { tomorrowInAppTimezone } from '../../utils/date.js';
import { toDDMMYYYY } from '../../utils/date.js';

interface TestResponseHeaders {
  'set-cookie'?: string | string[];
}

function cookieHeaderFrom(response: { headers: TestResponseHeaders }): string[] {
  const cookies = response.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
}

function authCookieFrom(response: { headers: TestResponseHeaders }): string {
  const authCookie = cookieHeaderFrom(response).find((cookie) =>
    cookie.startsWith('sweety_access_token='),
  );

  if (!authCookie) {
    throw new Error('Authentication cookie was not returned.');
  }

  return authCookie.split(';')[0] ?? '';
}

async function registerTestUser(email: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Demo User', email, password: 'SecurePassword123' });

  expect(response.status).toBe(201);
  return authCookieFrom(response);
}

const DATE_ONLY_PATTERN = /^\d{2}-\d{2}-\d{4}$/;

// A fixed day in the past so creation tests never hit the future-date rule.
// The API speaks DD-MM-YYYY; the database stores YYYY-MM-DD.
const PAST_DATE = '15-01-2026';
const PAST_DATE_ISO = '2026-01-15';

async function createReading(cookie: string, body: Record<string, unknown>) {
  return request(app).post('/api/readings').set('Cookie', cookie).send(body);
}

/** Bulk-inserts readings across consecutive days, four per day. */
async function insertReadingSeries(email: string, count: number): Promise<string> {
  const userId = (
    await getTestPool().query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
  ).rows[0]?.id;

  if (!userId) {
    throw new Error(`Test user ${email} was not found.`);
  }

  const slots = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'] as const;
  const rows = Array.from({ length: count }, (_, index) => ({
    userId,
    readingDate: `2026-01-${String(Math.floor(index / 4) + 1).padStart(2, '0')}`,
    slot: slots[index % slots.length]!,
    value: 100 + index,
  }));

  await db.insert(readings).values(rows);
  return userId;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestPool();
});

describe('authentication for reading endpoints', () => {
  it('rejects unauthenticated creation, listing, retrieval, update, and deletion', async () => {
    const id = randomUUID();

    const createResponse = await request(app)
      .post('/api/readings')
      .send({ readingDate: PAST_DATE, slot: 'morning', value: 105 });
    const listResponse = await request(app).get('/api/readings');
    const getResponse = await request(app).get(`/api/readings/${id}`);
    const updateResponse = await request(app).patch(`/api/readings/${id}`).send({ value: 120 });
    const deleteResponse = await request(app).delete(`/api/readings/${id}`);

    for (const response of [
      createResponse,
      listResponse,
      getResponse,
      updateResponse,
      deleteResponse,
    ]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Authentication required.',
      });
    }
  });
});

describe('POST /api/readings (create)', () => {
  it('creates a reading and keeps readingDate as a date-only string', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      userId: expect.any(String),
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body.readingDate).toMatch(DATE_ONLY_PATTERN);
    expect(response.body.readingDate).toBe(PAST_DATE);
  });

  it('rejects a missing glucose value with the exact message', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, { readingDate: PAST_DATE, slot: 'morning' });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'value', message: 'Please enter a glucose value.' },
    ]);
  });

  it('rejects a value below 40', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 39,
    });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'value', message: 'Value must be between 40 and 600 mg/dl.' },
    ]);
  });

  it('rejects a value above 600', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 601,
    });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'value', message: 'Value must be between 40 and 600 mg/dl.' },
    ]);
  });

  it('rejects a decimal value', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105.5,
    });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'value', message: 'Value must be between 40 and 600 mg/dl.' },
    ]);
  });

  it('rejects an unsupported slot', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'noon',
      value: 105,
    });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      {
        path: 'slot',
        message: 'Slot must be one of morning, after_breakfast, after_lunch, or after_dinner.',
      },
    ]);
  });

  it('rejects an impossible calendar date', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, {
      readingDate: '2026-02-30',
      slot: 'morning',
      value: 105,
    });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'readingDate', message: 'Please enter a valid date in DD-MM-YYYY format.' },
    ]);
  });

  it('rejects a date in the future with the exact message', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await createReading(cookie, {
      readingDate: toDDMMYYYY(tomorrowInAppTimezone()),
      slot: 'morning',
      value: 105,
    });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'readingDate', message: 'Date cannot be in the future.' },
    ]);
  });

  it('rejects a duplicate slot on the same date with a friendly conflict message', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    await createReading(cookie, { readingDate: PAST_DATE, slot: 'morning', value: 105 });
    const response = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 120,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'error',
      message: 'You already have a Morning (fasting) reading for this date.',
    });

    const count = await getTestPool().query<{ count: string }>('SELECT count(*) FROM readings');
    expect(count.rows[0]?.count).toBe('1');
  });

  it('uses the "an" article for slots whose label starts with a vowel', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'after_breakfast',
      value: 130,
    });
    const response = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'after_breakfast',
      value: 140,
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'You already have an After breakfast reading for this date.',
    );
  });

  it('allows the same slot on a different date', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    await createReading(cookie, { readingDate: PAST_DATE, slot: 'morning', value: 105 });
    const response = await createReading(cookie, {
      readingDate: '16-01-2026',
      slot: 'morning',
      value: 110,
    });

    expect(response.status).toBe(201);
    expect(response.body.readingDate).toBe('16-01-2026');
  });

  it('allows the same date and slot for two different users', async () => {
    const cookieA = await registerTestUser('reader-a@example.com');
    const cookieB = await registerTestUser('reader-b@example.com');

    const responseA = await createReading(cookieA, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });
    const responseB = await createReading(cookieB, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 120,
    });

    expect(responseA.status).toBe(201);
    expect(responseB.status).toBe(201);
    expect(responseA.body.userId).not.toBe(responseB.body.userId);
  });

  it('allows four readings in one day', async () => {
    const cookie = await registerTestUser('reader-a@example.com');

    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      const response = await createReading(cookie, {
        readingDate: PAST_DATE,
        slot,
        value: 100,
      });
      expect(response.status).toBe(201);
    }
  });

  it('rejects a fifth reading on the same day with the exact daily-limit message', async () => {
    const cookie = await registerTestUser('reader-a@example.com');

    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      await createReading(cookie, { readingDate: PAST_DATE, slot, value: 100 });
    }

    // The day already holds four readings, so any fifth attempt conflicts.
    const sameDayLimit = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 110,
    });
    expect(sameDayLimit.status).toBe(409);
    expect(sameDayLimit.body).toEqual({
      status: 'error',
      message: 'You can add only 4 readings per day.',
    });

    // A new day is unaffected by the previous day's limit.
    const nextDay = await createReading(cookie, {
      readingDate: '16-01-2026',
      slot: 'morning',
      value: 110,
    });
    expect(nextDay.status).toBe(201);
  });
});

describe('GET /api/readings (list)', () => {
  it("returns only the authenticated user's readings", async () => {
    const cookieA = await registerTestUser('reader-a@example.com');
    const cookieB = await registerTestUser('reader-b@example.com');

    await createReading(cookieA, { readingDate: PAST_DATE, slot: 'morning', value: 100 });
    await createReading(cookieA, { readingDate: PAST_DATE, slot: 'after_lunch', value: 150 });
    await createReading(cookieB, { readingDate: PAST_DATE, slot: 'morning', value: 200 });

    const response = await request(app).get('/api/readings').set('Cookie', cookieA);

    expect(response.status).toBe(200);
    expect(response.body.data.map((reading: { value: number }) => reading.value)).toEqual([
      100, 150,
    ]);
  });

  it('filters by a single date', async () => {
    const cookie = await registerTestUser('reader-a@example.com');

    await createReading(cookie, { readingDate: PAST_DATE, slot: 'morning', value: 100 });
    await createReading(cookie, { readingDate: '16-01-2026', slot: 'morning', value: 110 });

    const response = await request(app)
      .get('/api/readings')
      .query({ date: PAST_DATE })
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].readingDate).toBe(PAST_DATE);
  });

  it('filters by a from/to range', async () => {
    const cookie = await registerTestUser('reader-a@example.com');

    await createReading(cookie, { readingDate: '10-01-2026', slot: 'morning', value: 100 });
    await createReading(cookie, { readingDate: '12-01-2026', slot: 'morning', value: 110 });
    await createReading(cookie, { readingDate: '20-01-2026', slot: 'morning', value: 120 });

    const response = await request(app)
      .get('/api/readings')
      .query({ from: '11-01-2026', to: '15-01-2026' })
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].readingDate).toBe('12-01-2026');
  });

  it('rejects combining date with from', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await request(app)
      .get('/api/readings')
      .query({ date: PAST_DATE, from: '10-01-2026' })
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: '', message: 'The date filter cannot be combined with from or to.' },
    ]);
  });

  it('rejects combining date with to', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await request(app)
      .get('/api/readings')
      .query({ date: PAST_DATE, to: '10-01-2026' })
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.details[0].message).toBe(
      'The date filter cannot be combined with from or to.',
    );
  });

  it('rejects a from date later than the to date', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await request(app)
      .get('/api/readings')
      .query({ from: '20-01-2026', to: '10-01-2026' })
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: '', message: 'The from date cannot be later than the to date.' },
    ]);
  });

  it('rejects an invalid filter date', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await request(app)
      .get('/api/readings')
      .query({ date: 'not-a-date' })
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'date', message: 'Please enter a valid date in DD-MM-YYYY format.' },
    ]);
  });

  it('rejects a future filter date', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await request(app)
      .get('/api/readings')
      .query({ date: toDDMMYYYY(tomorrowInAppTimezone()) })
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'date', message: 'Date cannot be in the future.' },
    ]);
  });

  it('sorts by readingDate descending then slot order', async () => {
    const cookie = await registerTestUser('reader-a@example.com');

    await createReading(cookie, { readingDate: '10-01-2026', slot: 'morning', value: 100 });
    await createReading(cookie, { readingDate: '12-01-2026', slot: 'after_dinner', value: 200 });
    await createReading(cookie, { readingDate: '12-01-2026', slot: 'morning', value: 100 });
    await createReading(cookie, { readingDate: '12-01-2026', slot: 'after_lunch', value: 170 });
    await createReading(cookie, {
      readingDate: '12-01-2026',
      slot: 'after_breakfast',
      value: 130,
    });

    const response = await request(app).get('/api/readings').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ readingDate: '12-01-2026', slot: 'morning' }),
      expect.objectContaining({ readingDate: '12-01-2026', slot: 'after_breakfast' }),
      expect.objectContaining({ readingDate: '12-01-2026', slot: 'after_lunch' }),
      expect.objectContaining({ readingDate: '12-01-2026', slot: 'after_dinner' }),
      expect.objectContaining({ readingDate: '10-01-2026', slot: 'morning' }),
    ]);
  });
});

describe('GET /api/readings pagination', () => {
  it('defaults to page 1 with 20 readings and returns complete metadata', async () => {
    const cookie = await registerTestUser('page-defaults@example.com');
    await insertReadingSeries('page-defaults@example.com', 45);

    const response = await request(app).get('/api/readings').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(20);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('returns a custom limit and the remaining readings on the final page', async () => {
    const cookie = await registerTestUser('page-limit@example.com');
    await insertReadingSeries('page-limit@example.com', 45);

    const secondPage = await request(app)
      .get('/api/readings')
      .query({ page: 2, limit: 10 })
      .set('Cookie', cookie);
    const finalPage = await request(app)
      .get('/api/readings')
      .query({ page: 3, limit: 20 })
      .set('Cookie', cookie);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data).toHaveLength(10);
    expect(secondPage.body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 45,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    expect(finalPage.status).toBe(200);
    expect(finalPage.body.data).toHaveLength(5);
    expect(finalPage.body.pagination).toEqual({
      page: 3,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('never repeats a reading across adjacent pages', async () => {
    const cookie = await registerTestUser('page-overlap@example.com');
    await insertReadingSeries('page-overlap@example.com', 45);

    const firstPage = await request(app)
      .get('/api/readings')
      .query({ page: 1, limit: 20 })
      .set('Cookie', cookie);
    const secondPage = await request(app)
      .get('/api/readings')
      .query({ page: 2, limit: 20 })
      .set('Cookie', cookie);
    const firstIds = new Set(firstPage.body.data.map((reading: { id: string }) => reading.id));

    expect(secondPage.body.data).toHaveLength(20);
    for (const reading of secondPage.body.data as Array<{ id: string }>) {
      expect(firstIds.has(reading.id)).toBe(false);
    }
  });

  it('returns an empty page with valid metadata beyond the last page', async () => {
    const cookie = await registerTestUser('page-beyond@example.com');
    await insertReadingSeries('page-beyond@example.com', 45);

    const response = await request(app)
      .get('/api/readings')
      .query({ page: 999, limit: 20 })
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      pagination: {
        page: 999,
        limit: 20,
        total: 45,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });
  });

  it('applies pagination after date filtering and counts only filtered readings', async () => {
    const cookie = await registerTestUser('page-filter@example.com');
    await insertReadingSeries('page-filter@example.com', 45);

    const response = await request(app)
      .get('/api/readings')
      .query({ from: '01-01-2026', to: '03-01-2026', page: 1, limit: 5 })
      .set('Cookie', cookie);
    const finalPage = await request(app)
      .get('/api/readings')
      .query({ from: '01-01-2026', to: '03-01-2026', page: 3, limit: 5 })
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 5,
      total: 12,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(finalPage.body.data).toHaveLength(2);
  });

  it('returns a valid empty response for a user with no readings', async () => {
    const cookie = await registerTestUser('page-empty@example.com');

    const response = await request(app).get('/api/readings').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it('keeps totals and records scoped to the authenticated user', async () => {
    const cookieA = await registerTestUser('page-owner-a@example.com');
    const cookieB = await registerTestUser('page-owner-b@example.com');
    const userAId = await insertReadingSeries('page-owner-a@example.com', 30);
    const userBId = await insertReadingSeries('page-owner-b@example.com', 5);

    const responseA = await request(app)
      .get('/api/readings')
      .query({ page: 2, limit: 20 })
      .set('Cookie', cookieA);
    const responseB = await request(app)
      .get('/api/readings')
      .query({ page: 2, limit: 20 })
      .set('Cookie', cookieB);
    const beyondA = await request(app)
      .get('/api/readings')
      .query({ page: 999, limit: 20 })
      .set('Cookie', cookieA);

    expect(responseA.status).toBe(200);
    expect(responseA.body.pagination.total).toBe(30);
    expect(responseA.body.data).toHaveLength(10);
    expect(
      responseA.body.data.every((reading: { userId: string }) => reading.userId === userAId),
    ).toBe(true);

    expect(responseB.status).toBe(200);
    expect(responseB.body.pagination.total).toBe(5);
    expect(responseB.body.data).toHaveLength(0);
    expect(
      responseB.body.data.every((reading: { userId: string }) => reading.userId === userBId),
    ).toBe(true);

    expect(beyondA.body.pagination.total).toBe(30);
    expect(beyondA.body.data).toEqual([]);
  });

  it.each([
    {
      label: 'page=0',
      query: { page: '0' },
      path: 'page',
      message: 'Page must be a positive integer.',
    },
    {
      label: 'page=-1',
      query: { page: '-1' },
      path: 'page',
      message: 'Page must be a positive integer.',
    },
    {
      label: 'page=abc',
      query: { page: 'abc' },
      path: 'page',
      message: 'Page must be a positive integer.',
    },
    {
      label: 'limit=0',
      query: { limit: '0' },
      path: 'limit',
      message: 'Limit must be a whole number from 1 to 100.',
    },
    {
      label: 'limit=-1',
      query: { limit: '-1' },
      path: 'limit',
      message: 'Limit must be a whole number from 1 to 100.',
    },
    {
      label: 'limit=101',
      query: { limit: '101' },
      path: 'limit',
      message: 'Limit must be a whole number from 1 to 100.',
    },
  ])('rejects $label', async ({ query, path, message }) => {
    const cookie = await registerTestUser(`page-invalid-${randomUUID()}@example.com`);

    const response = await request(app).get('/api/readings').query(query).set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Validation failed',
      details: [{ path, message }],
    });
  });
});

describe('GET /api/readings/:id (single)', () => {
  it('returns the reading to its owner', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const created = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .get(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: created.body.id,
      userId: created.body.userId,
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body.readingDate).toMatch(DATE_ONLY_PATTERN);
  });

  it("returns 404 for another user's reading without revealing it", async () => {
    const cookieA = await registerTestUser('reader-a@example.com');
    const cookieB = await registerTestUser('reader-b@example.com');
    const created = await createReading(cookieA, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .get(`/api/readings/${created.body.id}`)
      .set('Cookie', cookieB);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 'error', message: 'Reading not found.' });
  });

  it('returns 404 for a nonexistent reading', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const response = await request(app).get(`/api/readings/${randomUUID()}`).set('Cookie', cookie);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Reading not found.');
  });
});

describe('PATCH /api/readings/:id (update)', () => {
  it('lets the owner update a reading and refresh updatedAt', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const created = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .patch(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ value: 140 });

    expect(response.status).toBe(200);
    expect(response.body.value).toBe(140);
    expect(response.body.readingDate).toBe(PAST_DATE);
    expect(response.body.slot).toBe('morning');
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.body.updatedAt).getTime(),
    );
  });

  it('supports a partial slot-only update', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const created = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .patch(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ slot: 'after_dinner' });

    expect(response.status).toBe(200);
    expect(response.body.slot).toBe('after_dinner');
    expect(response.body.value).toBe(105);
    expect(response.body.readingDate).toBe(PAST_DATE);
  });

  it('rejects an invalid value on update', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const created = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .patch(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ value: 700 });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'value', message: 'Value must be between 40 and 600 mg/dl.' },
    ]);
  });

  it('rejects a future date on update', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const created = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .patch(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ readingDate: toDDMMYYYY(tomorrowInAppTimezone()) });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'readingDate', message: 'Date cannot be in the future.' },
    ]);
  });

  it('rejects an update that conflicts with an existing slot on the same date', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const morning = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });
    await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'after_breakfast',
      value: 130,
    });

    const response = await request(app)
      .patch(`/api/readings/${morning.body.id}`)
      .set('Cookie', cookie)
      .send({ slot: 'after_breakfast' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'You already have an After breakfast reading for this date.',
    );
  });

  it('rejects an empty update body', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const created = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .patch(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: '', message: 'Provide at least one field to update.' },
    ]);
  });

  it('returns 404 when another user tries to update the reading', async () => {
    const cookieA = await registerTestUser('reader-a@example.com');
    const cookieB = await registerTestUser('reader-b@example.com');
    const created = await createReading(cookieA, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .patch(`/api/readings/${created.body.id}`)
      .set('Cookie', cookieB)
      .send({ value: 300 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 'error', message: 'Reading not found.' });
  });
});

describe('DELETE /api/readings/:id', () => {
  it('lets the owner delete a reading and returns a success response', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    const created = await createReading(cookie, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .delete(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'Reading deleted successfully.',
    });

    const getResponse = await request(app)
      .get(`/api/readings/${created.body.id}`)
      .set('Cookie', cookie);
    expect(getResponse.status).toBe(404);
  });

  it('returns 404 when another user tries to delete the reading and keeps the data', async () => {
    const cookieA = await registerTestUser('reader-a@example.com');
    const cookieB = await registerTestUser('reader-b@example.com');
    const created = await createReading(cookieA, {
      readingDate: PAST_DATE,
      slot: 'morning',
      value: 105,
    });

    const response = await request(app)
      .delete(`/api/readings/${created.body.id}`)
      .set('Cookie', cookieB);

    expect(response.status).toBe(404);

    const ownerResponse = await request(app)
      .get(`/api/readings/${created.body.id}`)
      .set('Cookie', cookieA);
    expect(ownerResponse.status).toBe(200);
  });
});

describe('readings database constraints', () => {
  it('enforces the value check constraint in the database', async () => {
    await registerTestUser('reader-a@example.com');
    const userId = (
      await getTestPool().query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
        'reader-a@example.com',
      ])
    ).rows[0]?.id as string;

    const insert = await getTestPool()
      .query(
        `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, $2, 'morning', 999)`,
        [userId, PAST_DATE_ISO],
      )
      .catch((error: { code?: string }) => error.code);

    expect(insert).toBe('23514');
  });

  it('cascades reading deletion when the user is deleted', async () => {
    const cookie = await registerTestUser('reader-a@example.com');
    await createReading(cookie, { readingDate: PAST_DATE, slot: 'morning', value: 105 });

    await getTestPool().query("DELETE FROM users WHERE email = 'reader-a@example.com'");

    const count = await getTestPool().query<{ count: string }>('SELECT count(*) FROM readings');
    expect(count.rows[0]?.count).toBe('0');
  });
});
