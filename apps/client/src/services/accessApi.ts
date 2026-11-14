import { apiFetch } from './http.js';

/** Patient-controlled doctor access API (`/api/patient`). */

export interface DoctorSummary {
  id: string;
  name: string;
  email: string;
}

export interface ActiveDoctorLink {
  assignmentId: string;
  acceptedAt: string | null;
  doctor: DoctorSummary;
}

export interface PendingInvitation {
  assignmentId: string;
  invitedAt: string;
  expiresAt: string;
  doctor: DoctorSummary;
}

export interface PatientAccessOverview {
  doctors: ActiveDoctorLink[];
  invitations: PendingInvitation[];
}

export function getPatientAccess(): Promise<PatientAccessOverview> {
  return apiFetch<PatientAccessOverview>('/api/patient/doctors');
}

export function acceptInvitation(token: string): Promise<{ status: string; message: string }> {
  return apiFetch('/api/patient/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function rejectInvitation(
  assignmentId: string,
): Promise<{ status: string; message: string }> {
  return apiFetch(`/api/patient/invitations/${encodeURIComponent(assignmentId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function revokeDoctor(assignmentId: string): Promise<void> {
  return apiFetch<{ status: string; message: string }>(
    `/api/patient/doctors/${encodeURIComponent(assignmentId)}`,
    { method: 'DELETE' },
  ).then(() => undefined);
}
