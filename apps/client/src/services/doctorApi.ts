import { apiFetch } from './http.js';
import type {
  DailyReport,
  PeriodReport,
  ReportJobStatus,
  ReportJobSubmission,
  ReportJobSubmitRequest,
} from '../types/report.js';
import type { ListReadingsFilters, PaginatedReadings, Reading } from '../types/reading.js';

/** Doctor read-only API (`/api/doctor`). Every patient path re-checks consent. */

export interface PatientSummary {
  id: string;
  name: string;
  email: string;
}

export interface DoctorPatientLink {
  assignmentId: string;
  acceptedAt: string | null;
  patient: PatientSummary;
}

export type AssignmentStatus = 'pending' | 'active' | 'revoked' | 'rejected' | 'expired';

export interface DoctorInvitation {
  assignmentId: string;
  status: AssignmentStatus;
  invitedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  revokedAt: string | null;
  expired: boolean;
  patient: PatientSummary;
}

export interface CreatedInvitation {
  assignmentId: string;
  patient: PatientSummary;
  status: 'pending';
  expiresAt: string;
  /** Returned exactly once; no email delivery exists in this deployment. */
  inviteToken: string;
}

function patientPath(patientId: string): string {
  return `/api/doctor/patients/${encodeURIComponent(patientId)}`;
}

function readingsQuery(filters: ListReadingsFilters): string {
  const query = new URLSearchParams();

  if (filters.date !== undefined) query.set('date', filters.date);
  if (filters.from !== undefined) query.set('from', filters.from);
  if (filters.to !== undefined) query.set('to', filters.to);
  if (filters.page !== undefined) query.set('page', String(filters.page));
  if (filters.limit !== undefined) query.set('limit', String(filters.limit));

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function listPatients(): Promise<DoctorPatientLink[]> {
  const result = await apiFetch<{ patients: DoctorPatientLink[] }>('/api/doctor/patients');
  return result.patients;
}

export async function listInvitations(): Promise<DoctorInvitation[]> {
  const result = await apiFetch<{ invitations: DoctorInvitation[] }>('/api/doctor/invitations');
  return result.invitations;
}

export function invitePatient(email: string): Promise<CreatedInvitation> {
  return apiFetch<CreatedInvitation>('/api/doctor/invitations', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function listPatientReadings(
  patientId: string,
  filters: ListReadingsFilters = {},
): Promise<PaginatedReadings> {
  return apiFetch<PaginatedReadings>(`${patientPath(patientId)}/readings${readingsQuery(filters)}`);
}

/** Walks every page of a patient's readings for report charts. */
export async function listAllPatientReadings(
  patientId: string,
  filters: ListReadingsFilters = {},
): Promise<Reading[]> {
  const readings: Reading[] = [];
  let page = 1;
  let totalPages: number;

  do {
    const result = await listPatientReadings(patientId, { ...filters, page, limit: 100 });
    readings.push(...result.data);
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return readings;
}

export function getPatientDailyReport(patientId: string, date: string): Promise<DailyReport> {
  return apiFetch<DailyReport>(
    `${patientPath(patientId)}/reports/daily?date=${encodeURIComponent(date)}`,
  );
}

export function getPatientMonthToDateReport(
  patientId: string,
  date: string,
): Promise<PeriodReport> {
  return apiFetch<PeriodReport>(
    `${patientPath(patientId)}/reports/month-to-date?date=${encodeURIComponent(date)}`,
  );
}

export function getPatientMonthlyReport(
  patientId: string,
  date?: string,
): Promise<PeriodReport> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<PeriodReport>(`${patientPath(patientId)}/reports/monthly${query}`);
}

export function submitPatientReportJob(
  patientId: string,
  request: ReportJobSubmitRequest,
): Promise<ReportJobSubmission> {
  return apiFetch<ReportJobSubmission>(`${patientPath(patientId)}/reports/jobs`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getPatientReportJobStatus(
  patientId: string,
  jobId: string,
): Promise<ReportJobStatus> {
  return apiFetch<ReportJobStatus>(
    `${patientPath(patientId)}/reports/jobs/${encodeURIComponent(jobId)}`,
  );
}

export function getPatientReportJobResult<
  T extends DailyReport | PeriodReport = DailyReport | PeriodReport,
>(patientId: string, jobId: string): Promise<T> {
  return apiFetch<T>(`${patientPath(patientId)}/reports/jobs/${encodeURIComponent(jobId)}/result`);
}
