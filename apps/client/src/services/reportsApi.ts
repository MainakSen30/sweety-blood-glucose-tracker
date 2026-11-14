import { apiFetch } from './http.js';
import type {
  DailyReport,
  PeriodReport,
  ReportJobStatus,
  ReportJobSubmission,
  ReportJobSubmitRequest,
} from '../types/report.js';

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

/** Enqueues an asynchronous report generation job with BullMQ. */
export function submitReportJob(request: ReportJobSubmitRequest): Promise<ReportJobSubmission> {
  return apiFetch<ReportJobSubmission>('/api/reports/jobs', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** Polls the status and progress of a report generation job. */
export function getReportJobStatus(jobId: string): Promise<ReportJobStatus> {
  return apiFetch<ReportJobStatus>(`/api/reports/jobs/${encodeURIComponent(jobId)}`);
}

/** Retrieves the final generated report once completed. */
export function getReportJobResult<
  T extends DailyReport | PeriodReport = DailyReport | PeriodReport,
>(jobId: string): Promise<T> {
  return apiFetch<T>(`/api/reports/jobs/${encodeURIComponent(jobId)}/result`);
}
