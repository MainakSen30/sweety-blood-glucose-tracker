import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rate-limit.js';
import { currentUser, login, logout, register } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, register);
authRouter.post('/login', authRateLimiter, login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, currentUser);
