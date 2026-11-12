import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { create, get, list, remove, update } from './readings.controller.js';

export const readingsRouter = Router();

// Every reading endpoint requires an authenticated user.
readingsRouter.use(requireAuth);

readingsRouter.post('/', create);
readingsRouter.get('/', list);
readingsRouter.get('/:id', get);
readingsRouter.patch('/:id', update);
readingsRouter.delete('/:id', remove);
