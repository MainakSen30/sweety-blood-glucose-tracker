/**
 * Safe, public shape of an application user.
 *
 * This intentionally contains no password or password-hash fields. It mirrors
 * the server's `SafeUser` type (apps/server/src/modules/auth/auth.types.ts).
 */
export interface SafeUser {
  id: string;
  name: string;
  email: string;
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
