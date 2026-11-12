import type { ReadingSlot } from '../../database/schema.js';

/**
 * API shapes of the report endpoints. All dates are DD-MM-YYYY strings (the
 * API date format); the database works with YYYY-MM-DD internally and the
 * service converts at the boundary.
 */

/** Aggregate statistics shared by every report type. */
export interface ReportSummary {
  highest: number | null;
  lowest: number | null;
  /** Mean of all individual readings, rounded to exactly one decimal place. */
  average: number | null;
  totalReadings: number;
}

/** An inclusive reporting period in DD-MM-YYYY form. */
export interface ReportPeriod {
  startDate: string;
  endDate: string;
}

/** One reading as it appears inside a daily report. */
export interface DailyReportReading {
  id: string;
  readingDate: string;
  slot: ReadingSlot;
  value: number;
}

export interface DailyReport {
  reportType: 'daily';
  date: string;
  summary: ReportSummary;
  readings: DailyReportReading[];
}

export interface PeriodReport {
  reportType: 'month-to-date' | 'monthly';
  period: ReportPeriod;
  summary: ReportSummary;
}
