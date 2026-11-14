import { HttpError } from '../../utils/errors.js';
import { invalidateUserReportCache } from '../../cache/reportCache.js';
import {
  acceptInvitation,
  createInvitation,
  findPatientAccountByEmail,
  hasActiveAssignment,
  listActivePatients,
  listDoctorInvitations,
  listPatientActiveDoctors,
  listPatientPendingInvitations,
  rejectInvitation,
  revokeAssignment,
  type DoctorInvitationSummary,
  type DoctorPatientLink,
  type PatientDoctorLink,
  type PatientInvitationLink,
} from './access.repository.js';
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
} from './invitationToken.js';

/**
 * Patient-consent business rules.
 *
 * A doctor can create an invitation, but only the intended patient can turn it
 * into access. Revocation is patient-only; a doctor can never reactivate an
 * existing row — a new invitation and a new patient acceptance are required.
 */

export interface CreatedInvitation {
  assignmentId: string;
  patient: { id: string; name: string; email: string };
  status: 'pending';
  expiresAt: Date;
  /** Plaintext token, returned exactly once. Never persisted or logged. */
  inviteToken: string;
}

export async function createDoctorInvitation(
  doctorId: string,
  email: string,
): Promise<CreatedInvitation> {
  const patient = await findPatientAccountByEmail(email);

  if (!patient) {
    // Deliberately generic: no public patient directory, and no distinction
    // between "no account" and "not a patient" is exposed.
    throw new HttpError(404, 'No patient account was found for that email address.');
  }

  if (patient.id === doctorId) {
    throw new HttpError(400, 'A doctor cannot be assigned to themselves.');
  }

  const inviteToken = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const assignment = await createInvitation({
    doctorId,
    patientId: patient.id,
    tokenHash: hashInvitationToken(inviteToken),
    expiresAt,
  });

  return {
    assignmentId: assignment.id,
    patient,
    status: 'pending',
    expiresAt: assignment.expiresAt,
    inviteToken,
  };
}

export async function acceptPatientInvitation(patientId: string, token: string): Promise<void> {
  const outcome = await acceptInvitation({
    tokenHash: hashInvitationToken(token),
    patientId,
    now: new Date(),
  });

  if (outcome.state === 'expired') {
    throw new HttpError(410, 'This invitation has expired.');
  }

  if (outcome.state === 'not_found') {
    // Covers invalid, already-consumed, revoked, and other-account tokens.
    throw new HttpError(404, 'Invitation not found.');
  }
}

export async function rejectPatientInvitation(
  patientId: string,
  assignmentId: string,
): Promise<void> {
  const rejected = await rejectInvitation({ assignmentId, patientId, now: new Date() });

  if (!rejected) {
    throw new HttpError(404, 'Invitation not found.');
  }
}

export async function revokePatientDoctor(patientId: string, assignmentId: string): Promise<void> {
  const revoked = await revokeAssignment({ assignmentId, patientId, now: new Date() });

  if (!revoked) {
    throw new HttpError(404, 'Doctor relationship not found.');
  }

  // Authorization checks run before every cache read, so this is freshness,
  // not the security boundary. It drops the patient's own and every doctor's
  // cached views of this patient's reports.
  await invalidateUserReportCache(patientId);
}

export async function getPatientAccessOverview(patientId: string): Promise<{
  doctors: PatientDoctorLink[];
  invitations: PatientInvitationLink[];
}> {
  const [doctors, invitations] = await Promise.all([
    listPatientActiveDoctors(patientId),
    listPatientPendingInvitations(patientId, new Date()),
  ]);

  return { doctors, invitations };
}

export async function getDoctorPatients(doctorId: string): Promise<DoctorPatientLink[]> {
  return listActivePatients(doctorId);
}

export interface DoctorInvitationDto extends Omit<DoctorInvitationSummary, 'expiresAt'> {
  expiresAt: Date;
  expired: boolean;
}

export async function getDoctorInvitations(doctorId: string): Promise<DoctorInvitationDto[]> {
  const now = Date.now();
  const invitations = await listDoctorInvitations(doctorId);

  return invitations.map((invitation) => ({
    ...invitation,
    expired: invitation.status === 'pending' && invitation.expiresAt.getTime() <= now,
  }));
}

/** Used by the worker before generating a doctor-requested report. */
export async function isDoctorAuthorizedForPatient(
  doctorId: string,
  patientId: string,
): Promise<boolean> {
  return hasActiveAssignment(doctorId, patientId);
}
