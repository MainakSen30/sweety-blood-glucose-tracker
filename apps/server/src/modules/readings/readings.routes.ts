import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { create, get, list, remove, update } from './readings.controller.js';

export const readingsRouter = Router();

// Readings are a patient's own records. Doctors get read-only access through
// `/api/doctor/patients/:patientId/readings`, never through this router.
readingsRouter.use(requireAuth, requireRole('patient'));

readingsRouter.post('/', create);
readingsRouter.get('/', list);
readingsRouter.get('/:id', get);
readingsRouter.patch('/:id', update);
readingsRouter.delete('/:id', remove);
