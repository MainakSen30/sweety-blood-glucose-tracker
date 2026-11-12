import type { ReadingSlot } from './reading.js';

/**
 * Report API shapes. All dates are DD-MM-YYYY strings — the same convention
 * as the readings API.
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

export type ReportType = 'daily' | 'month-to-date' | 'monthly';

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
