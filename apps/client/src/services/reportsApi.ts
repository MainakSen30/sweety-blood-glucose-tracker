import { apiFetch } from './http.js';
import type { DailyReport, PeriodReport } from '../types/report.js';

/**
 * Typed report API client.
 *
 * Uses the same cookie-based, same-origin HTTP client as every other API
 * call. No tokens are stored in web storage.
 */
export function getDailyReport(date: string): Promise<DailyReport> {
  return apiFetch<DailyReport>(`/api/reports/daily?date=${encodeURIComponent(date)}`);
}

export function getMonthToDateReport(date: string): Promise<PeriodReport> {
  return apiFetch<PeriodReport>(`/api/reports/month-to-date?date=${encodeURIComponent(date)}`);
}

export function getMonthlyReport(): Promise<PeriodReport> {
  return apiFetch<PeriodReport>('/api/reports/monthly');
}
