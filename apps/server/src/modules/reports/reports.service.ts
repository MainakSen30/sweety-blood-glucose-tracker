import { toDDMMYYYY, todayInAppTimezone } from '../../utils/date.js';
import type { Reading } from '../../database/schema.js';
import { listReadings } from '../readings/readings.repository.js';
import { aggregateUserReadings, type RawReadingAggregate } from './reports.repository.js';
import type {
  DailyReport,
  DailyReportReading,
  PeriodReport,
  ReportSummary,
} from './reports.types.js';

/**
 * Reporting business logic.
 *
 * Date-range helpers are pure functions of an ISO reference date so the
 * boundary rules (January wraps to the previous year, leap-year February,
 * inclusive ends) can be unit-tested without touching the system clock.
 * All dates here are internal YYYY-MM-DD; DD-MM-YYYY conversion happens only
 * when building the API response.
 */

export interface IsoPeriod {
  startDate: string;
  endDate: string;
}

/**
 * First day of the reference date's month through the reference date itself,
 * both inclusive.
 */
export function monthToDateRange(referenceIsoDate: string): IsoPeriod {
  return {
    startDate: `${referenceIsoDate.slice(0, 7)}-01`,
    endDate: referenceIsoDate,
  };
}

/**
 * First and last day of the calendar month before the reference date's month.
 *
 * `Date.UTC(year, month - 2, 1)` rolls January back to December of the
 * previous year, and day 0 of the following month is that month's last day,
 * so leap-year February (29 days) is handled without hardcoding month lengths.
 */
export function previousMonthRange(referenceIsoDate: string): IsoPeriod {
  const [year, month] = referenceIsoDate.split('-').map(Number) as [number, number];
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = previous.getUTCFullYear();
  const previousMonth = previous.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();

  return {
    startDate: `${previousYear}-${pad(previousMonth)}-01`,
    endDate: `${previousYear}-${pad(previousMonth)}-${pad(lastDay)}`,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export async function getDailyReport(userId: string, isoDate: string): Promise<DailyReport> {
  // Reuses the readings repository's single indexed query, which already
  // sorts by slot order (morning, after_breakfast, after_lunch, after_dinner).
  // Summary is computed from the same rows, so details and aggregates can
  // never disagree.
  const rows = await listReadings(userId, { date: isoDate });

  return {
    reportType: 'daily',
    date: toDDMMYYYY(isoDate),
    summary: summarizeValues(rows.map((row) => row.value)),
    readings: rows.map(toDailyReportReading),
  };
}

export async function getMonthToDateReport(userId: string, isoDate: string): Promise<PeriodReport> {
  const period = monthToDateRange(isoDate);
  const aggregate = await aggregateUserReadings(userId, period.startDate, period.endDate);

  return {
    reportType: 'month-to-date',
    period: toApiPeriod(period),
    summary: toSummary(aggregate),
  };
}

export async function getPreviousMonthReport(userId: string): Promise<PeriodReport> {
  const period = previousMonthRange(todayInAppTimezone());
  const aggregate = await aggregateUserReadings(userId, period.startDate, period.endDate);

  return {
    reportType: 'monthly',
    period: toApiPeriod(period),
    summary: toSummary(aggregate),
  };
}

/** Builds summary statistics from individual daily-report values. */
function summarizeValues(values: number[]): ReportSummary {
  if (values.length === 0) {
    return { highest: null, lowest: null, average: null, totalReadings: 0 };
  }

  return {
    highest: Math.max(...values),
    lowest: Math.min(...values),
    average: roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length),
    totalReadings: values.length,
  };
}

/** Converts a PostgreSQL aggregate row into the API summary shape. */
function toSummary(aggregate: RawReadingAggregate): ReportSummary {
  return {
    highest: aggregate.highest,
    lowest: aggregate.lowest,
    average: aggregate.average === null ? null : roundToOneDecimal(Number(aggregate.average)),
    totalReadings: aggregate.totalReadings,
  };
}

/** Rounds to exactly one decimal place (121.44 → 121.4, 121.46 → 121.5). */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function toDailyReportReading(reading: Reading): DailyReportReading {
  return {
    id: reading.id,
    readingDate: toDDMMYYYY(reading.readingDate),
    slot: reading.slot,
    value: reading.value,
  };
}

function toApiPeriod(period: IsoPeriod): { startDate: string; endDate: string } {
  return {
    startDate: toDDMMYYYY(period.startDate),
    endDate: toDDMMYYYY(period.endDate),
  };
}
