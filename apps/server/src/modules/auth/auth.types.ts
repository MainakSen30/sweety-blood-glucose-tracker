export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: SafeUser;
  token: string;
}

export type { LoginInput, RegisterInput } from './auth.validation.js';
