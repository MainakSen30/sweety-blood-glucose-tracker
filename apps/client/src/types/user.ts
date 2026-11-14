/**
 * Safe, public shape of an application user.
 *
 * This intentionally contains no password or password-hash fields. It mirrors
 * the server's `SafeUser` type (apps/server/src/modules/auth/auth.types.ts).
 */
export type UserRole = 'patient' | 'doctor';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Landing route for each role after authentication. */
export function roleHomePath(role: UserRole): string {
  return role === 'doctor' ? '/doctor/dashboard' : '/today';
}
