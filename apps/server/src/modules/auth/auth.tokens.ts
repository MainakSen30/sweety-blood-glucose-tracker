import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';

export const AUTH_COOKIE_NAME = 'sweety_access_token';

const tokenExpirationPattern = /^([1-9]\d*)([smhd])$/;

const expirationUnitMilliseconds = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: Math.floor(getAuthCookieMaxAge() / 1000),
  });
}

export function verifyAuthToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const subject = z.uuid().safeParse(payload.sub);

    return subject.success ? subject.data : null;
  } catch {
    return null;
  }
}

export function getAuthCookieMaxAge(): number {
  const match = tokenExpirationPattern.exec(env.JWT_EXPIRES_IN);

  if (!match) {
    throw new Error('JWT_EXPIRES_IN does not have a supported duration format.');
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || unit === undefined || !(unit in expirationUnitMilliseconds)) {
    throw new Error('JWT_EXPIRES_IN does not have a supported duration unit.');
  }

  return amount * expirationUnitMilliseconds[unit as keyof typeof expirationUnitMilliseconds];
}

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: getAuthCookieMaxAge(),
  };
}

/**
 * Options used when clearing the cookie. These match the identity and security
 * attributes of the cookie set by `authCookieOptions` (httpOnly, sameSite,
 * secure, path) but deliberately omit maxAge: Express renders the expiry as
 * `Expires=Thu, 01 Jan 1970`, and a maxAge value is not needed to delete.
 */
export function authCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setAuthCookie(response: Response, token: string): void {
  response.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

export function clearAuthCookie(response: Response): void {
  response.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions());
}
