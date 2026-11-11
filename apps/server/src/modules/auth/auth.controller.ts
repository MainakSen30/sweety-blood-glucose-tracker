import type { Request, Response } from 'express';
import { getCurrentUser, loginUser, registerUser } from './auth.service.js';
import { loginSchema, registerSchema } from './auth.validation.js';
import { clearAuthCookie, setAuthCookie } from './auth.tokens.js';
import { formatValidationIssues } from '../../utils/validation.js';
import { HttpError } from '../../utils/errors.js';

export async function register(request: Request, response: Response): Promise<Response> {
  const parsedInput = registerSchema.safeParse(request.body);

  if (!parsedInput.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedInput.error),
    });
  }

  const session = await registerUser(parsedInput.data);
  setAuthCookie(response, session.token);

  return response.status(201).json(session.user);
}

export async function login(request: Request, response: Response): Promise<Response> {
  const parsedInput = loginSchema.safeParse(request.body);

  if (!parsedInput.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedInput.error),
    });
  }

  const session = await loginUser(parsedInput.data);
  setAuthCookie(response, session.token);

  return response.status(200).json(session.user);
}

export async function currentUser(request: Request, response: Response): Promise<Response> {
  const userId = request.authenticatedUserId;

  if (!userId) {
    throw new HttpError(401, 'Authentication required.');
  }

  const user = await getCurrentUser(userId);
  return response.status(200).json(user);
}

export function logout(_request: Request, response: Response): Response {
  clearAuthCookie(response);
  return response.status(200).json({ status: 'ok', message: 'Logged out successfully.' });
}
