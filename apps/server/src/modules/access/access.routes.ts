import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  acceptInvitation,
  listPatientAccess,
  rejectInvitation,
  revokeDoctor,
} from './access.controller.js';

/** Patient-controlled consent API: `/api/patient/*`. */
export const patientAccessRouter = Router();

patientAccessRouter.use(requireAuth, requireRole('patient'));

patientAccessRouter.get('/doctors', listPatientAccess);
patientAccessRouter.post('/invitations/accept', acceptInvitation);
patientAccessRouter.post('/invitations/:assignmentId/reject', rejectInvitation);
patientAccessRouter.delete('/doctors/:assignmentId', revokeDoctor);
