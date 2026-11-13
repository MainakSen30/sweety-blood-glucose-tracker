/**
 * Step E – Report calculation supplemental tests
 *
 * Covers missing cases from the test plan:
 *   D1-6   – single reading: avg = min = max
 *   D1-12  – today's date accepted for daily report
 *   D1-13  – first day of a month
 *   D1-14  – last day of a month
 *   D2-10  – single reading in month-to-date period
 *   D2-11  – reference date is first of the month (period of one day)
 *   D3-5   – previousMonthRange: December → November of same year
 *   D3-6   – monthToDateRange: reference date is last day of month
 *   D4-5   – single reading in previous-month report
 *   D4-6   – previous month is December (31 days)
 *
 * Also covers cross-user isolation and users with no readings across all three
 * report views (additional angles beyond the existing suite).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { closeTestPool, resetDatabase } from '../../../tests/database.js';
import { toDDMMYYYY, todayInAppTimezone } from '../../utils/date.js';
import { monthToDateRange, previousMonthRange } from './reports.service.js';

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
    .send({ name: 'Report User', email, password: 'SecurePassword123' });
  expect(res.status).toBe(201);
  return authCookieFrom(res);
}

async function seedReading(
  cookie: string,
  readingDate: string,
  slot: string,
  value: number,
): Promise<void> {
  const res = await request(app)
    .post('/api/readings')
    .set('Cookie', cookie)
    .send({ readingDate, slot, value });
  expect(res.status).toBe(201);
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// D3 – Pure date-range helpers (supplemental unit tests)
// ---------------------------------------------------------------------------
describe('date-range helpers (supplemental)', () => {
  it('D3-5: previousMonthRange for December returns November of the same year', () => {
    // December → previous month is November of the same year.
    expect(previousMonthRange('2025-12-15')).toEqual({
      startDate: '2025-11-01',
      endDate: '2025-11-30',
    });
  });

  it('D3-6: monthToDateRange when reference date is the last day of the month', () => {
    // January 31 → period covers the whole of January.
    expect(monthToDateRange('2026-01-31')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });

  it('D3-6b: monthToDateRange for the first day gives a one-day period', () => {
    expect(monthToDateRange('2026-03-01')).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-01',
    });
  });

  it('D3-5b: previousMonthRange handles the Jan→Dec year transition correctly', () => {
    // January of 2026 → previous month is December 2025.
    expect(previousMonthRange('2026-01-01')).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    });
  });
});

// ---------------------------------------------------------------------------
// D1 – Daily report (supplemental)
// ---------------------------------------------------------------------------
describe('GET /api/reports/daily (supplemental)', () => {
  it('D1-6: single reading — average equals the value, highest equals lowest', async () => {
    const cookie = await registerTestUser('daily-single@example.com');
    await seedReading(cookie, '10-01-2026', 'morning', 150);

    const res = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '10-01-2026' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      highest: 150,
      lowest: 150,
      average: 150,
      totalReadings: 1,
    });
    expect(res.body.readings).toHaveLength(1);
    expect(res.body.readings[0].value).toBe(150);
  });

  it('D1-12: today is accepted as a valid daily report date', async () => {
    const cookie = await registerTestUser('daily-today@example.com');
    const today = toDDMMYYYY(todayInAppTimezone());

    // Seed a reading for today and verify the report reflects it.
    await seedReading(cookie, today, 'morning', 120);

    const res = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: today });

    expect(res.status).toBe(200);
    expect(res.body.summary.totalReadings).toBe(1);
    expect(res.body.summary.highest).toBe(120);
  });

  it('D1-13: first day of a month is returned correctly', async () => {
    const cookie = await registerTestUser('daily-first@example.com');
    await seedReading(cookie, '01-01-2026', 'morning', 90);

    const res = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '01-01-2026' });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('01-01-2026');
    expect(res.body.summary.totalReadings).toBe(1);
  });

  it('D1-14: last day of a month is returned correctly', async () => {
    const cookie = await registerTestUser('daily-last@example.com');
    await seedReading(cookie, '31-01-2026', 'morning', 95);

    const res = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '31-01-2026' });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('31-01-2026');
    expect(res.body.summary.totalReadings).toBe(1);
  });

  it('user with no readings at all gets an empty daily report', async () => {
    const cookie = await registerTestUser('daily-empty@example.com');

    const res = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '15-01-2026' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      highest: null,
      lowest: null,
      average: null,
      totalReadings: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// D2 – Month-to-date report (supplemental)
// ---------------------------------------------------------------------------
describe('GET /api/reports/month-to-date (supplemental)', () => {
  it('D2-10: single reading in the period — avg = min = max', async () => {
    const cookie = await registerTestUser('mtd-single@example.com');
    await seedReading(cookie, '05-02-2026', 'morning', 200);

    const res = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: '15-02-2026' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      highest: 200,
      lowest: 200,
      average: 200,
      totalReadings: 1,
    });
  });

  it('D2-11: reference date on the first of the month gives a one-day period', async () => {
    const cookie = await registerTestUser('mtd-first@example.com');
    // Seed the first day and the previous month — only the first day must be counted.
    await seedReading(cookie, '01-03-2026', 'morning', 110);
    await seedReading(cookie, '28-02-2026', 'morning', 500); // previous month, must be excluded

    const res = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: '01-03-2026' });

    expect(res.status).toBe(200);
    expect(res.body.period).toEqual({ startDate: '01-03-2026', endDate: '01-03-2026' });
    expect(res.body.summary).toEqual({
      highest: 110,
      lowest: 110,
      average: 110,
      totalReadings: 1,
    });
  });

  it('user with no readings at all gets an empty month-to-date report', async () => {
    const cookie = await registerTestUser('mtd-empty@example.com');

    const res = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: '15-01-2026' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      highest: null,
      lowest: null,
      average: null,
      totalReadings: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// D4 – Previous-month report (supplemental)
// ---------------------------------------------------------------------------
describe('GET /api/reports/monthly (supplemental)', () => {
  it('D4-5: single reading in the previous month — avg = min = max', async () => {
    const cookie = await registerTestUser('monthly-single@example.com');
    const previous = previousMonthRange(todayInAppTimezone());

    await seedReading(cookie, toDDMMYYYY(previous.startDate), 'morning', 180);

    const res = await request(app).get('/api/reports/monthly').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      highest: 180,
      lowest: 180,
      average: 180,
      totalReadings: 1,
    });
  });

  it('D4-6: when previous month is December, all 31 days are included', () => {
    // Pure helper test — no DB involved.
    // Pick a reference date in January to make December the previous month.
    const result = previousMonthRange('2026-01-15');
    expect(result.startDate).toBe('2025-12-01');
    expect(result.endDate).toBe('2025-12-31');
  });

  it('user with no readings gets an empty previous-month report', async () => {
    const cookie = await registerTestUser('monthly-no-readings@example.com');

    const res = await request(app).get('/api/reports/monthly').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      highest: null,
      lowest: null,
      average: null,
      totalReadings: 0,
    });
  });

  it('cross-user isolation: User B report never sees User A readings', async () => {
    const userA = await registerTestUser('monthly-a@example.com');
    const userB = await registerTestUser('monthly-b@example.com');
    const previous = previousMonthRange(todayInAppTimezone());

    // User A seeds the entire previous month's boundary dates.
    await seedReading(userA, toDDMMYYYY(previous.startDate), 'morning', 400);
    await seedReading(userA, toDDMMYYYY(previous.endDate), 'after_dinner', 500);

    const res = await request(app).get('/api/reports/monthly').set('Cookie', userB);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalReadings).toBe(0);
    expect(res.body.summary.highest).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rounding behaviour documentation
// ---------------------------------------------------------------------------
describe('report average rounding (documented behaviour)', () => {
  /**
   * roundToOneDecimal uses Math.round(x * 10) / 10.
   *
   * JavaScript floating-point note:
   *   Math.round(1.005 * 10) / 10 may yield 1 instead of 1.1 on some
   *   engines due to IEEE-754 representation. This test documents the
   *   ACTUAL behaviour; do not change the production code to fix it.
   */
  it('average of values 100, 101, 100 rounds to 100.3 (documented behaviour)', async () => {
    // 301 / 3 = 100.333… → Math.round(100.333… * 10) / 10 = 1003.33… rounds to 1003 → 100.3
    const cookie = await registerTestUser('round-doc@example.com');
    await seedReading(cookie, '10-01-2026', 'morning', 100);
    await seedReading(cookie, '10-01-2026', 'after_breakfast', 101);
    await seedReading(cookie, '10-01-2026', 'after_lunch', 100);

    const res = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '10-01-2026' });

    expect(res.status).toBe(200);
    // 301/3 = 100.3333…; Math.round(100.3333… * 10) / 10 = 100.3
    expect(res.body.summary.average).toBe(100.3);
  });
});
