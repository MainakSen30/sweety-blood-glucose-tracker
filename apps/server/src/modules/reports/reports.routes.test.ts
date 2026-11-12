import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { closeTestPool, resetDatabase } from '../../../tests/database.js';
import { toDDMMYYYY, todayInAppTimezone, tomorrowInAppTimezone } from '../../utils/date.js';
import { monthToDateRange, previousMonthRange } from './reports.service.js';

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

async function createReading(cookie: string, body: Record<string, unknown>) {
  return request(app).post('/api/readings').set('Cookie', cookie).send(body);
}

/** Seeds a reading through the API and fails the test if creation fails. */
async function seedReading(
  cookie: string,
  readingDate: string,
  slot: string,
  value: number,
): Promise<void> {
  const response = await createReading(cookie, { readingDate, slot, value });

  expect(response.status).toBe(201);
}

const INVALID_DATE_MESSAGE = 'Please enter a valid date in DD-MM-YYYY format.';
const FUTURE_DATE_MESSAGE = 'Date cannot be in the future.';

// A fixed day in the past so seeding never hits the future-date rule.
const REPORT_DATE = '15-01-2026';
// The four known values from the assignment example: average 122.0.
const KNOWN_VALUES: Array<[string, number]> = [
  ['morning', 95],
  ['after_breakfast', 145],
  ['after_lunch', 130],
  ['after_dinner', 118],
];

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestPool();
});

describe('date-range calculation (pure helpers with an injected reference date)', () => {
  it('month-to-date starts on the first of the reference month and ends on the reference date', () => {
    expect(monthToDateRange('2026-11-12')).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-12',
    });
  });

  it('previous month of January is December of the previous year', () => {
    expect(previousMonthRange('2026-01-15')).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    });
  });

  it('previous month of a leap-year March has a 29-day February', () => {
    expect(previousMonthRange('2024-03-10')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
  });

  it('previous month of a non-leap-year March has a 28-day February', () => {
    expect(previousMonthRange('2023-03-10')).toEqual({
      startDate: '2023-02-01',
      endDate: '2023-02-28',
    });
  });
});

describe('authentication for report endpoints', () => {
  it('rejects requests without an authentication cookie', async () => {
    const dailyResponse = await request(app).get('/api/reports/daily').query({ date: REPORT_DATE });
    const monthToDateResponse = await request(app)
      .get('/api/reports/month-to-date')
      .query({ date: REPORT_DATE });
    const monthlyResponse = await request(app).get('/api/reports/monthly');

    for (const response of [dailyResponse, monthToDateResponse, monthlyResponse]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ status: 'error', message: 'Authentication required.' });
    }
  });

  it('rejects requests with an invalid authentication cookie', async () => {
    const cookie = 'sweety_access_token=not-a-real-token';

    const dailyResponse = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: REPORT_DATE });
    const monthToDateResponse = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: REPORT_DATE });
    const monthlyResponse = await request(app).get('/api/reports/monthly').set('Cookie', cookie);

    for (const response of [dailyResponse, monthToDateResponse, monthlyResponse]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ status: 'error', message: 'Authentication required.' });
    }
  });
});

describe('GET /api/reports/daily', () => {
  it('returns the known aggregates and readings in slot order', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    // Insert deliberately out of slot order; the report must sort by slot.
    for (const [slot, value] of [...KNOWN_VALUES].reverse()) {
      await seedReading(cookie, REPORT_DATE, slot, value);
    }

    const response = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: REPORT_DATE });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reportType: 'daily',
      date: REPORT_DATE,
      summary: { highest: 145, lowest: 95, average: 122, totalReadings: 4 },
      readings: [
        { id: expect.any(String), readingDate: REPORT_DATE, slot: 'morning', value: 95 },
        {
          id: expect.any(String),
          readingDate: REPORT_DATE,
          slot: 'after_breakfast',
          value: 145,
        },
        { id: expect.any(String), readingDate: REPORT_DATE, slot: 'after_lunch', value: 130 },
        { id: expect.any(String), readingDate: REPORT_DATE, slot: 'after_dinner', value: 118 },
      ],
    });
  });

  it('rounds the average to one decimal place in both directions', async () => {
    const cookie = await registerTestUser('report-a@example.com');
    await seedReading(cookie, '10-01-2026', 'morning', 100);
    await seedReading(cookie, '10-01-2026', 'after_breakfast', 101);
    await seedReading(cookie, '11-01-2026', 'morning', 100);
    await seedReading(cookie, '11-01-2026', 'after_breakfast', 100);
    await seedReading(cookie, '11-01-2026', 'after_lunch', 102);

    const roundedDown = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '11-01-2026' });
    const roundedUp = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '10-01-2026' });

    expect(roundedDown.body.summary.average).toBe(100.7); // 302 / 3 = 100.666…
    expect(roundedUp.body.summary.average).toBe(100.5);
  });

  it('returns a successful empty report (not 404) when the date has no readings', async () => {
    const cookie = await registerTestUser('report-empty@example.com');

    const response = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: REPORT_DATE });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reportType: 'daily',
      date: REPORT_DATE,
      summary: { highest: null, lowest: null, average: null, totalReadings: 0 },
      readings: [],
    });
  });

  it('rejects a missing date', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    const response = await request(app).get('/api/reports/daily').set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([{ path: 'date', message: INVALID_DATE_MESSAGE }]);
  });

  it('rejects a date in the wrong format', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    const response = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '2026-01-15' });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([{ path: 'date', message: INVALID_DATE_MESSAGE }]);
  });

  it('rejects an impossible calendar date', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    const response = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: '31-02-2026' });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([{ path: 'date', message: INVALID_DATE_MESSAGE }]);
  });

  it('rejects a future date', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    const response = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', cookie)
      .query({ date: toDDMMYYYY(tomorrowInAppTimezone()) });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([{ path: 'date', message: FUTURE_DATE_MESSAGE }]);
  });

  it("excludes another user's readings on the same date", async () => {
    const userA = await registerTestUser('report-a@example.com');
    const userB = await registerTestUser('report-b@example.com');

    await seedReading(userA, REPORT_DATE, 'morning', 95);
    await seedReading(userA, REPORT_DATE, 'after_breakfast', 145);
    await seedReading(userB, REPORT_DATE, 'morning', 500);
    await seedReading(userB, REPORT_DATE, 'after_breakfast', 600);

    const response = await request(app)
      .get('/api/reports/daily')
      .set('Cookie', userA)
      .query({ date: REPORT_DATE });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual({
      highest: 145,
      lowest: 95,
      average: 120,
      totalReadings: 2,
    });
    expect(response.body.readings).toHaveLength(2);
    expect(response.body.readings.map((reading: { value: number }) => reading.value)).toEqual([
      95, 145,
    ]);
  });
});

describe('GET /api/reports/month-to-date', () => {
  it('reports the period from the first of the month to the selected date, boundaries included', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    await seedReading(cookie, '01-01-2026', 'morning', 100); // first-day boundary
    await seedReading(cookie, REPORT_DATE, 'morning', 110); // selected-date boundary
    await seedReading(cookie, '16-01-2026', 'morning', 200); // after the end date
    await seedReading(cookie, '20-01-2026', 'after_dinner', 300); // after the end date
    await seedReading(cookie, '15-12-2025', 'morning', 90); // previous month

    const response = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: REPORT_DATE });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reportType: 'month-to-date',
      period: { startDate: '01-01-2026', endDate: REPORT_DATE },
      summary: { highest: 110, lowest: 100, average: 105, totalReadings: 2 },
    });
  });

  it('averages the individual readings, not the daily averages', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    // Daily averages: 100 and 104 → averaging the averages would give 102.
    // The individual-readings average is 412 / 4 = 103.
    await seedReading(cookie, '01-01-2026', 'morning', 100);
    await seedReading(cookie, '02-01-2026', 'morning', 100);
    await seedReading(cookie, '02-01-2026', 'after_breakfast', 100);
    await seedReading(cookie, '02-01-2026', 'after_lunch', 112);

    const response = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: '02-01-2026' });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual({
      highest: 112,
      lowest: 100,
      average: 103,
      totalReadings: 4,
    });
  });

  it('returns a successful empty report when the period has no readings', async () => {
    const cookie = await registerTestUser('report-empty@example.com');

    const response = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: REPORT_DATE });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reportType: 'month-to-date',
      period: { startDate: '01-01-2026', endDate: REPORT_DATE },
      summary: { highest: null, lowest: null, average: null, totalReadings: 0 },
    });
  });

  it("excludes another user's readings in the same period", async () => {
    const userA = await registerTestUser('report-a@example.com');
    const userB = await registerTestUser('report-b@example.com');

    await seedReading(userA, '01-01-2026', 'morning', 100);
    await seedReading(userB, '02-01-2026', 'morning', 600);
    await seedReading(userB, '03-01-2026', 'morning', 600);

    const response = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', userA)
      .query({ date: REPORT_DATE });

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual({
      highest: 100,
      lowest: 100,
      average: 100,
      totalReadings: 1,
    });
  });

  it('rejects a missing, malformed, impossible, or future date', async () => {
    const cookie = await registerTestUser('report-a@example.com');

    const missing = await request(app).get('/api/reports/month-to-date').set('Cookie', cookie);
    const malformed = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: '15/01/2026' });
    const impossible = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: '30-02-2026' });
    const future = await request(app)
      .get('/api/reports/month-to-date')
      .set('Cookie', cookie)
      .query({ date: toDDMMYYYY(tomorrowInAppTimezone()) });

    for (const response of [missing, malformed, impossible]) {
      expect(response.status).toBe(400);
      expect(response.body.details).toEqual([{ path: 'date', message: INVALID_DATE_MESSAGE }]);
    }
    expect(future.status).toBe(400);
    expect(future.body.details).toEqual([{ path: 'date', message: FUTURE_DATE_MESSAGE }]);
  });
});

describe('GET /api/reports/monthly', () => {
  it('reports the whole previous calendar month and excludes current-month readings', async () => {
    const cookie = await registerTestUser('report-a@example.com');
    const previous = previousMonthRange(todayInAppTimezone());

    await seedReading(cookie, toDDMMYYYY(previous.startDate), 'morning', 100);
    await seedReading(cookie, toDDMMYYYY(previous.endDate), 'after_dinner', 150);
    await seedReading(cookie, toDDMMYYYY(todayInAppTimezone()), 'morning', 600); // current month

    const response = await request(app).get('/api/reports/monthly').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reportType: 'monthly',
      period: {
        startDate: toDDMMYYYY(previous.startDate),
        endDate: toDDMMYYYY(previous.endDate),
      },
      summary: { highest: 150, lowest: 100, average: 125, totalReadings: 2 },
    });
  });

  it('returns a successful empty report when the previous month has no readings', async () => {
    const cookie = await registerTestUser('report-empty@example.com');

    const response = await request(app).get('/api/reports/monthly').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reportType: 'monthly',
      period: expect.objectContaining({
        startDate: expect.stringMatching(/^\d{2}-\d{2}-\d{4}$/),
        endDate: expect.stringMatching(/^\d{2}-\d{2}-\d{4}$/),
      }),
      summary: { highest: null, lowest: null, average: null, totalReadings: 0 },
    });
  });

  it("excludes another user's readings in the previous month", async () => {
    const userA = await registerTestUser('report-a@example.com');
    const userB = await registerTestUser('report-b@example.com');
    const previous = previousMonthRange(todayInAppTimezone());

    await seedReading(userA, toDDMMYYYY(previous.startDate), 'morning', 100);
    await seedReading(userB, toDDMMYYYY(previous.endDate), 'morning', 600);

    const response = await request(app).get('/api/reports/monthly').set('Cookie', userA);

    expect(response.status).toBe(200);
    expect(response.body.summary).toEqual({
      highest: 100,
      lowest: 100,
      average: 100,
      totalReadings: 1,
    });
  });
});
