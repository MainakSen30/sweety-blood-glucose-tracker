import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { daily, monthToDate, monthly } from './reports.controller.js';

export const reportsRouter = Router();

// Every report endpoint requires an authenticated user.
reportsRouter.use(requireAuth);

reportsRouter.get('/daily', daily);
reportsRouter.get('/month-to-date', monthToDate);
reportsRouter.get('/monthly', monthly);
