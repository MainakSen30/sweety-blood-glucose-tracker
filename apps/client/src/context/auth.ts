import { createContext, useContext } from 'react';
import type { LoginInput, RegisterInput, SafeUser, UserRole } from '../types/user.js';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Credentials were valid, but the account's server-assigned role differs from
 * the panel the visitor selected. The session is discarded, not upgraded.
 */
export class RoleMismatchError extends Error {
  readonly actualRole: UserRole;

  constructor(actualRole: UserRole) {
    super(`Account belongs to the ${actualRole} role.`);
    this.name = 'RoleMismatchError';
    this.actualRole = actualRole;
  }
}

export interface AuthContextValue {
  user: SafeUser | null;
  status: AuthStatus;
  login: (input: LoginInput, expectedRole: UserRole) => Promise<SafeUser>;
  register: (input: RegisterInput) => Promise<SafeUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
