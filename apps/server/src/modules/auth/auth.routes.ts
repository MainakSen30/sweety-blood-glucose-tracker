import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { currentUser, login, logout, register } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, currentUser);
