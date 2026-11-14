import type { UserRole } from '../../database/schema.js';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: SafeUser;
  token: string;
}

export type { LoginInput, RegisterInput } from './auth.validation.js';
