import bcrypt from 'bcryptjs';
import type { User } from '../../database/schema.js';
import { findUserByEmail, findUserById, insertUser } from './auth.repository.js';
import { signAuthToken } from './auth.tokens.js';
import type { AuthSession, LoginInput, RegisterInput, SafeUser } from './auth.types.js';
import { HttpError } from '../../utils/errors.js';

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthSession> {
  const user = await insertUser({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  return { user: toSafeUser(user), token: signAuthToken(user.id) };
}

export async function loginUser(input: LoginInput): Promise<AuthSession> {
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  return { user: toSafeUser(user), token: signAuthToken(user.id) };
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await findUserById(userId);

  if (!user) {
    throw new HttpError(401, 'Authentication required.');
  }

  return toSafeUser(user);
}
