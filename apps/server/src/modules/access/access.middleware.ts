import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../../utils/errors.js';
import { hasActiveAssignment } from './access.repository.js';

declare global {
  /* eslint-disable-next-line @typescript-eslint/no-namespace -- required for Express request augmentation */
  namespace Express {
    interface Request {
      /** Patient id proven to be actively assigned to the authenticated doctor. */
      authorizedPatientId?: string;
    }
  }
}

const patientIdSchema = z.uuid();

/**
 * Doctor authorization gate for every `/api/doctor/patients/:patientId/*`
 * route. The patient id comes from the URL, but access is decided solely by
 * the authenticated doctor identity and the current active relationship, not
 * by the id itself.
 *
 * A 404 is returned for both "no such patient" and "no active authorization"
 * so the endpoint cannot be used to enumerate patients.
 */
export async function requireActivePatientAssignment(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  const doctorId = request.authenticatedUserId;

  if (!doctorId) {
    throw new HttpError(401, 'Authentication required.');
  }

  const parsedPatientId = patientIdSchema.safeParse(request.params.patientId);

  if (!parsedPatientId.success) {
    throw new HttpError(400, 'Please provide a valid patient id.');
  }

  const authorized = await hasActiveAssignment(doctorId, parsedPatientId.data);

  if (!authorized) {
    throw new HttpError(404, 'Patient not found.');
  }

  request.authorizedPatientId = parsedPatientId.data;
  next();
}

export function requireAuthorizedPatientId(request: Request): string {
  const patientId = request.authorizedPatientId;

  if (!patientId) {
    throw new HttpError(404, 'Patient not found.');
  }

  return patientId;
}
