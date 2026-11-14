import { appReportCache } from '../../cache/reportCache.js';
import type { ReportCacheKeyParts } from '../../cache/reportCache.js';
import {
  getDailyReport,
  getMonthToDateReport,
  getPreviousMonthReport,
  previousMonthRange,
} from './reports.service.js';
import type { DailyReport, PeriodReport } from './reports.types.js';
import { todayInAppTimezone } from '../../utils/date.js';

/**
 * Cache-aside composition of the report services.
 *
 * The reporting service stays the only place that calculates reports; this
 * layer only decides *whether* the calculation runs. The cache key includes
 * the authenticated user id (never anything from the query string) and every
 * response-affecting parameter, normalized to internal YYYY-MM-DD dates.
 */
export function getDailyReportCached(userId: string, isoDate: string): Promise<DailyReport> {
  const parts: ReportCacheKeyParts = { userId, reportType: 'daily', date: isoDate };
  return appReportCache.getReport(parts, () => getDailyReport(userId, isoDate));
}

export function getMonthToDateReportCached(userId: string, isoDate: string): Promise<PeriodReport> {
  const parts: ReportCacheKeyParts = {
    userId,
    reportType: 'month-to-date',
    // The month-to-date range derives purely from the reference date, so the
    // date alone identifies the computed period.
    date: isoDate,
  };
  return appReportCache.getReport(parts, () => getMonthToDateReport(userId, isoDate));
}

export async function getPreviousMonthReportCached(userId: string): Promise<PeriodReport> {
  // The previous-month window depends on "today" in Asia/Kolkata, so it is
  // part of the key: after midnight the first request recomputes.
  const period = previousMonthRange(todayInAppTimezone());
  const parts: ReportCacheKeyParts = {
    userId,
    reportType: 'monthly',
    startDate: period.startDate,
    endDate: period.endDate,
  };
  return appReportCache.getReport(parts, () => getPreviousMonthReport(userId));
}
