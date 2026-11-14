import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { daily, monthToDate, monthly } from './reports.controller.js';
import {
  reportJobResultHandler,
  reportJobStatusHandler,
  submitReportJobHandler,
} from './reports.jobs.controller.js';

export const reportsRouter = Router();

// Every self-report endpoint belongs to the patient role. Doctors read
// assigned patients' reports through `/api/doctor/patients/:patientId/reports`.
reportsRouter.use(requireAuth, requireRole('patient'));

reportsRouter.get('/daily', daily);
reportsRouter.get('/month-to-date', monthToDate);
reportsRouter.get('/monthly', monthly);

// Asynchronous report generation: submit, poll status, fetch the result.
reportsRouter.post('/jobs', submitReportJobHandler);
reportsRouter.get('/jobs/:jobId', reportJobStatusHandler);
reportsRouter.get('/jobs/:jobId/result', reportJobResultHandler);
