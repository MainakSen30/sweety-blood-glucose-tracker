import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { doctorInvitationRateLimiter } from '../../middleware/rate-limit.js';
import { requireActivePatientAssignment } from '../access/access.middleware.js';
import {
  dailyReport,
  getPatientReading,
  invitePatient,
  listInvitations,
  listPatientReadings,
  listPatients,
  monthlyReport,
  monthToDateReport,
  patientReportJobResult,
  patientReportJobStatus,
  submitPatientReportJob,
} from './doctor.controller.js';

/**
 * Doctor API: `/api/doctor/*`.
 *
 * Only authenticated doctors reach the handlers. Read-only access to a
 * patient additionally requires an active, patient-accepted assignment, which
 * `requireActivePatientAssignment` re-checks on every request.
 */
export const doctorRouter = Router();

doctorRouter.use(requireAuth, requireRole('doctor'));

doctorRouter.get('/patients', listPatients);
doctorRouter.get('/invitations', listInvitations);
doctorRouter.post('/invitations', doctorInvitationRateLimiter, invitePatient);

doctorRouter.use('/patients/:patientId', requireActivePatientAssignment);

doctorRouter.get('/patients/:patientId/readings', listPatientReadings);
doctorRouter.get('/patients/:patientId/readings/:readingId', getPatientReading);

doctorRouter.get('/patients/:patientId/reports/daily', dailyReport);
doctorRouter.get('/patients/:patientId/reports/month-to-date', monthToDateReport);
doctorRouter.get('/patients/:patientId/reports/monthly', monthlyReport);

doctorRouter.post('/patients/:patientId/reports/jobs', submitPatientReportJob);
doctorRouter.get('/patients/:patientId/reports/jobs/:jobId', patientReportJobStatus);
doctorRouter.get('/patients/:patientId/reports/jobs/:jobId/result', patientReportJobResult);
