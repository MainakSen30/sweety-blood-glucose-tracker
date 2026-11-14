import type { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../modules/auth/auth.tokens.js';
import { findUserById } from '../modules/auth/auth.repository.js';
import { toSafeUser } from '../modules/auth/auth.service.js';
import type { SafeUser } from '../modules/auth/auth.types.js';
import type { UserRole } from '../database/schema.js';
import { HttpError } from '../utils/errors.js';

declare global {
  /* eslint-disable-next-line @typescript-eslint/no-namespace -- required for Express request augmentation */
  namespace Express {
    interface Request {
      authenticatedUserId?: string;
      /**
       * Server-side identity for this request, including the current database
       * role. Never derived from a client-supplied field, and reloaded on
       * every request so a role change takes effect immediately.
       */
      authenticatedUser?: SafeUser;
    }
  }
}

/**
 * Verifies the HTTP-only cookie and loads the current user row.
 *
 * The role is read from PostgreSQL rather than trusted from the JWT, so a
 * promoted doctor (or a role change) applies on the next request without
 * waiting for the token to expire, and a stale token can never carry a
 * privileged role the account no longer has.
 */
export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  const token = request.cookies?.[AUTH_COOKIE_NAME];
  const userId = typeof token === 'string' ? verifyAuthToken(token) : null;

  if (!userId) {
    throw new HttpError(401, 'Authentication required.');
  }

  const user = await findUserById(userId);

  if (!user) {
    throw new HttpError(401, 'Authentication required.');
  }

  request.authenticatedUserId = user.id;
  request.authenticatedUser = toSafeUser(user);
  next();
}

/** Restricts a route to one role. Must run after `requireAuth`. */
export function requireRole(role: UserRole) {
  return function roleGuard(request: Request, _response: Response, next: NextFunction): void {
    if (!request.authenticatedUser) {
      throw new HttpError(401, 'Authentication required.');
    }

    if (request.authenticatedUser.role !== role) {
      throw new HttpError(403, 'You do not have permission to perform this action.');
    }

    next();
  };
}

export function requireAuthenticatedUser(request: Request): SafeUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, 'Authentication required.');
  }

  return request.authenticatedUser;
}
