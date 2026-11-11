import { apiFetch } from './http.js';
import type { LoginInput, RegisterInput, SafeUser } from '../types/user.js';

/**
 * Typed authentication API client.
 *
 * All requests use relative paths so they stay same-origin and the browser
 * automatically attaches the HTTP-only auth cookie. No tokens are stored in
 * localStorage or sessionStorage.
 */
export function registerUser(input: RegisterInput): Promise<SafeUser> {
  return apiFetch<SafeUser>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function loginUser(input: LoginInput): Promise<SafeUser> {
  return apiFetch<SafeUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logoutUser(): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>('/api/auth/logout', {
    method: 'POST',
  });
}

export function getCurrentUser(): Promise<SafeUser> {
  return apiFetch<SafeUser>('/api/auth/me');
}
