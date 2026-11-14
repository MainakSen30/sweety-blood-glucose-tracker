import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { daily, monthToDate, monthly } from './reports.controller.js';
import {
  reportJobResultHandler,
  reportJobStatusHandler,
  submitReportJobHandler,
} from './reports.jobs.controller.js';

export const reportsRouter = Router();

// Every report endpoint requires an authenticated user.
reportsRouter.use(requireAuth);

reportsRouter.get('/daily', daily);
reportsRouter.get('/month-to-date', monthToDate);
reportsRouter.get('/monthly', monthly);

// Asynchronous report generation: submit, poll status, fetch the result.
reportsRouter.post('/jobs', submitReportJobHandler);
reportsRouter.get('/jobs/:jobId', reportJobStatusHandler);
reportsRouter.get('/jobs/:jobId/result', reportJobResultHandler);
