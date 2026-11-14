import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../../database/index.js';
import {
  doctorPatientAssignments,
  users,
  type DoctorPatientAssignment,
  type UserRole,
} from '../../database/schema.js';
import { isCheckViolationError, isUniqueViolationError } from '../../utils/database-errors.js';
import { HttpError } from '../../utils/errors.js';

/**
 * Persistence for doctor–patient authorization.
 *
 * Every authorization-affecting query filters on `status = 'active'`; status is
 * never inferred from timestamps alone. Historical rows (revoked / rejected /
 * expired) are kept for auditability.
 */

export interface PatientAccount {
  id: string;
  name: string;
  email: string;
}

export interface DoctorAccount extends PatientAccount {
  role: UserRole;
}

export interface PatientDoctorLink {
  assignmentId: string;
  doctor: PatientAccount;
  acceptedAt: Date | null;
}

export interface PatientInvitationLink {
  assignmentId: string;
  doctor: PatientAccount;
  invitedAt: Date;
  expiresAt: Date;
}

export interface DoctorPatientLink {
  assignmentId: string;
  patient: PatientAccount;
  acceptedAt: Date | null;
}

export interface DoctorInvitationSummary {
  assignmentId: string;
  patient: PatientAccount;
  status: DoctorPatientAssignment['status'];
  invitedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  revokedAt: Date | null;
}

/** Finds an account by email regardless of case. */
export async function findPatientAccountByEmail(email: string): Promise<PatientAccount | null> {
  const result = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);

  const row = result[0];
  return row && row.role === 'patient' ? { id: row.id, name: row.name, email: row.email } : null;
}

/**
 * Marks stale pending invitations for this pair as expired so a fresh
 * invitation is allowed by the partial unique index.
 */
async function expireStalePending(
  executor: Pick<typeof db, 'update'>,
  doctorId: string,
  patientId: string,
  now: Date,
): Promise<void> {
  await executor
    .update(doctorPatientAssignments)
    .set({ status: 'expired', tokenHash: null, updatedAt: now })
    .where(
      and(
        eq(doctorPatientAssignments.doctorId, doctorId),
        eq(doctorPatientAssignments.patientId, patientId),
        eq(doctorPatientAssignments.status, 'pending'),
        sql`${doctorPatientAssignments.expiresAt} <= ${now}`,
      ),
    );
}

export async function createInvitation(input: {
  doctorId: string;
  patientId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<DoctorPatientAssignment> {
  const now = new Date();

  return db.transaction(async (tx) => {
    await expireStalePending(tx, input.doctorId, input.patientId, now);

    try {
      const [row] = await tx
        .insert(doctorPatientAssignments)
        .values({
          doctorId: input.doctorId,
          patientId: input.patientId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        })
        .returning();

      if (!row) {
        throw new Error('Invitation insertion did not return a row.');
      }

      return row;
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new HttpError(409, 'An invitation to this patient is already pending.');
      }

      if (isCheckViolationError(error)) {
        throw new HttpError(400, 'A patient cannot be assigned to themselves.');
      }

      throw error;
    }
  });
}

export type AcceptInvitationOutcome =
  { state: 'accepted' } | { state: 'not_found' } | { state: 'expired' };

/**
 * Accepts an invitation atomically. The row is locked, re-validated (token,
 * pending status, expiry, intended patient, doctor role) and consumed by
 * nulling the token hash. A consumed or foreign token is indistinguishable
 * from a missing one to the caller.
 */
export async function acceptInvitation(input: {
  tokenHash: string;
  patientId: string;
  now: Date;
}): Promise<AcceptInvitationOutcome> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: doctorPatientAssignments.id,
        doctorId: doctorPatientAssignments.doctorId,
        patientId: doctorPatientAssignments.patientId,
        status: doctorPatientAssignments.status,
        expiresAt: doctorPatientAssignments.expiresAt,
        doctorRole: users.role,
      })
      .from(doctorPatientAssignments)
      .innerJoin(users, eq(users.id, doctorPatientAssignments.doctorId))
      .where(eq(doctorPatientAssignments.tokenHash, input.tokenHash))
      .limit(1)
      .for('update');

    const row = rows[0];

    if (
      !row ||
      row.status !== 'pending' ||
      row.patientId !== input.patientId ||
      row.doctorRole !== 'doctor'
    ) {
      return { state: 'not_found' };
    }

    if (row.expiresAt.getTime() <= input.now.getTime()) {
      return { state: 'expired' };
    }

    await tx
      .update(doctorPatientAssignments)
      .set({
        status: 'active',
        acceptedAt: input.now,
        tokenHash: null,
        updatedAt: input.now,
      })
      .where(eq(doctorPatientAssignments.id, row.id));

    return { state: 'accepted' };
  });
}

export async function rejectInvitation(input: {
  assignmentId: string;
  patientId: string;
  now: Date;
}): Promise<boolean> {
  const result = await db
    .update(doctorPatientAssignments)
    .set({
      status: 'rejected',
      rejectedAt: input.now,
      tokenHash: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(doctorPatientAssignments.id, input.assignmentId),
        eq(doctorPatientAssignments.patientId, input.patientId),
        eq(doctorPatientAssignments.status, 'pending'),
      ),
    )
    .returning({ id: doctorPatientAssignments.id });

  return result.length > 0;
}

export async function revokeAssignment(input: {
  assignmentId: string;
  patientId: string;
  now: Date;
}): Promise<boolean> {
  const result = await db
    .update(doctorPatientAssignments)
    .set({
      status: 'revoked',
      revokedAt: input.now,
      tokenHash: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(doctorPatientAssignments.id, input.assignmentId),
        eq(doctorPatientAssignments.patientId, input.patientId),
        eq(doctorPatientAssignments.status, 'active'),
      ),
    )
    .returning({ id: doctorPatientAssignments.id });

  return result.length > 0;
}

/**
 * The single authorization primitive for doctor access.
 *
 * Joins the users table so a demoted doctor (or a patient whose role changed)
 * loses access even if the assignment row still says `active`.
 */
export async function hasActiveAssignment(doctorId: string, patientId: string): Promise<boolean> {
  const result = await db
    .select({ id: doctorPatientAssignments.id })
    .from(doctorPatientAssignments)
    .innerJoin(users, eq(users.id, doctorPatientAssignments.doctorId))
    .where(
      and(
        eq(doctorPatientAssignments.doctorId, doctorId),
        eq(doctorPatientAssignments.patientId, patientId),
        eq(doctorPatientAssignments.status, 'active'),
        eq(users.role, 'doctor'),
        sql`${doctorPatientAssignments.doctorId} <> ${doctorPatientAssignments.patientId}`,
      ),
    )
    .limit(1);

  return result.length > 0;
}

export async function listActivePatients(doctorId: string): Promise<DoctorPatientLink[]> {
  const rows = await db
    .select({
      assignmentId: doctorPatientAssignments.id,
      acceptedAt: doctorPatientAssignments.acceptedAt,
      patientId: users.id,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(doctorPatientAssignments)
    .innerJoin(users, eq(users.id, doctorPatientAssignments.patientId))
    .where(
      and(
        eq(doctorPatientAssignments.doctorId, doctorId),
        eq(doctorPatientAssignments.status, 'active'),
        eq(users.role, 'patient'),
      ),
    )
    .orderBy(desc(doctorPatientAssignments.acceptedAt));

  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    acceptedAt: row.acceptedAt,
    patient: { id: row.patientId, name: row.patientName, email: row.patientEmail },
  }));
}

export async function listDoctorInvitations(doctorId: string): Promise<DoctorInvitationSummary[]> {
  const rows = await db
    .select({
      assignmentId: doctorPatientAssignments.id,
      status: doctorPatientAssignments.status,
      invitedAt: doctorPatientAssignments.invitedAt,
      expiresAt: doctorPatientAssignments.expiresAt,
      acceptedAt: doctorPatientAssignments.acceptedAt,
      rejectedAt: doctorPatientAssignments.rejectedAt,
      revokedAt: doctorPatientAssignments.revokedAt,
      patientId: users.id,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(doctorPatientAssignments)
    .innerJoin(users, eq(users.id, doctorPatientAssignments.patientId))
    .where(eq(doctorPatientAssignments.doctorId, doctorId))
    .orderBy(desc(doctorPatientAssignments.createdAt));

  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    status: row.status,
    invitedAt: row.invitedAt,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    rejectedAt: row.rejectedAt,
    revokedAt: row.revokedAt,
    patient: { id: row.patientId, name: row.patientName, email: row.patientEmail },
  }));
}

export async function listPatientActiveDoctors(patientId: string): Promise<PatientDoctorLink[]> {
  const rows = await db
    .select({
      assignmentId: doctorPatientAssignments.id,
      acceptedAt: doctorPatientAssignments.acceptedAt,
      doctorId: users.id,
      doctorName: users.name,
      doctorEmail: users.email,
    })
    .from(doctorPatientAssignments)
    .innerJoin(users, eq(users.id, doctorPatientAssignments.doctorId))
    .where(
      and(
        eq(doctorPatientAssignments.patientId, patientId),
        eq(doctorPatientAssignments.status, 'active'),
        eq(users.role, 'doctor'),
      ),
    )
    .orderBy(desc(doctorPatientAssignments.acceptedAt));

  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    acceptedAt: row.acceptedAt,
    doctor: { id: row.doctorId, name: row.doctorName, email: row.doctorEmail },
  }));
}

export async function listPatientPendingInvitations(
  patientId: string,
  now: Date,
): Promise<PatientInvitationLink[]> {
  const rows = await db
    .select({
      assignmentId: doctorPatientAssignments.id,
      invitedAt: doctorPatientAssignments.invitedAt,
      expiresAt: doctorPatientAssignments.expiresAt,
      doctorId: users.id,
      doctorName: users.name,
      doctorEmail: users.email,
    })
    .from(doctorPatientAssignments)
    .innerJoin(users, eq(users.id, doctorPatientAssignments.doctorId))
    .where(
      and(
        eq(doctorPatientAssignments.patientId, patientId),
        eq(doctorPatientAssignments.status, 'pending'),
        gt(doctorPatientAssignments.expiresAt, now),
        eq(users.role, 'doctor'),
      ),
    )
    .orderBy(desc(doctorPatientAssignments.invitedAt));

  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    invitedAt: row.invitedAt,
    expiresAt: row.expiresAt,
    doctor: { id: row.doctorId, name: row.doctorName, email: row.doctorEmail },
  }));
}
