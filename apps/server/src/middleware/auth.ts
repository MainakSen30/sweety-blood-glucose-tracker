import type { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../modules/auth/auth.tokens.js';
import { HttpError } from '../utils/errors.js';

declare global {
  /* eslint-disable-next-line @typescript-eslint/no-namespace -- required for Express request augmentation */
  namespace Express {
    interface Request {
      authenticatedUserId?: string;
    }
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const token = request.cookies?.[AUTH_COOKIE_NAME];
  const userId = typeof token === 'string' ? verifyAuthToken(token) : null;

  if (!userId) {
    throw new HttpError(401, 'Authentication required.');
  }

  request.authenticatedUserId = userId;
  next();
}
