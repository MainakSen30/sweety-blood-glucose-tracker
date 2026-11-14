import type { Request, Response } from 'express';
import { HttpError } from '../../utils/errors.js';
import { formatValidationIssues } from '../../utils/validation.js';
import {
  acceptPatientInvitation,
  getPatientAccessOverview,
  rejectPatientInvitation,
  revokePatientDoctor,
} from './access.service.js';
import { acceptInvitationSchema, assignmentIdParamSchema } from './access.validation.js';

/**
 * Patient-facing consent endpoints. Every route is mounted behind
 * `requireAuth` + `requireRole('patient')`; the patient id always comes from
 * the authenticated session, never from the URL or body.
 */
function requirePatientId(request: Request): string {
  const patientId = request.authenticatedUserId;

  if (!patientId) {
    throw new HttpError(401, 'Authentication required.');
  }

  return patientId;
}

function requireAssignmentId(request: Request): string {
  const parsed = assignmentIdParamSchema.safeParse(request.params.assignmentId);

  if (!parsed.success) {
    throw new HttpError(400, 'Please provide a valid relationship id.');
  }

  return parsed.data;
}

export async function listPatientAccess(request: Request, response: Response): Promise<Response> {
  const overview = await getPatientAccessOverview(requirePatientId(request));
  return response.status(200).json(overview);
}

export async function acceptInvitation(request: Request, response: Response): Promise<Response> {
  const parsed = acceptInvitationSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsed.error),
    });
  }

  await acceptPatientInvitation(requirePatientId(request), parsed.data.token);
  return response.status(200).json({ status: 'ok', message: 'Doctor access granted.' });
}

export async function rejectInvitation(request: Request, response: Response): Promise<Response> {
  await rejectPatientInvitation(requirePatientId(request), requireAssignmentId(request));
  return response.status(200).json({ status: 'ok', message: 'Invitation rejected.' });
}

export async function revokeDoctor(request: Request, response: Response): Promise<Response> {
  await revokePatientDoctor(requirePatientId(request), requireAssignmentId(request));
  return response.status(200).json({ status: 'ok', message: 'Doctor access revoked.' });
}
