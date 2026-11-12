import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { AUTH_COOKIE_NAME } from './auth.tokens.js';
import { closeTestPool, getTestPool, resetUsersTable } from '../../../tests/database.js';

const testPassword = 'SecurePassword123';

interface TestResponseHeaders {
  'set-cookie'?: string | string[];
}

function cookieHeaderFrom(response: { headers: TestResponseHeaders }): string[] {
  const cookies = response.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
}

function authCookieFrom(response: { headers: TestResponseHeaders }): string {
  const authCookie = cookieHeaderFrom(response).find((cookie) =>
    cookie.startsWith(`${AUTH_COOKIE_NAME}=`),
  );

  if (!authCookie) {
    throw new Error('Authentication cookie was not returned.');
  }

  return authCookie.split(';')[0] ?? '';
}

async function registerUser(email: string, password: string = testPassword) {
  return request(app).post('/api/auth/register').send({ name: 'Demo User', email, password });
}

beforeEach(async () => {
  await resetUsersTable();
});

afterAll(async () => {
  await closeTestPool();
});

describe('POST /api/auth/register', () => {
  it('creates a user, hashes the password, and returns a safe user with a cookie', async () => {
    const response = await registerUser('Demo@Example.com');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      name: 'Demo User',
      email: 'demo@example.com',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('passwordHash');

    const cookies = cookieHeaderFrom(response);
    expect(cookies.join(';')).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(cookies.join(';')).toContain('HttpOnly');
    expect(cookies.join(';')).toContain('SameSite=Lax');

    const result = await getTestPool().query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE lower(email) = $1',
      ['demo@example.com'],
    );
    const storedUser = result.rows[0];

    expect(storedUser).toBeDefined();
    expect(storedUser?.password_hash).not.toContain(testPassword);
    await expect(bcrypt.compare(testPassword, storedUser?.password_hash ?? '')).resolves.toBe(true);
  });

  it('rejects a duplicate email case-insensitively', async () => {
    await registerUser('demo@example.com');
    const response = await registerUser('DEMO@EXAMPLE.COM');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'error',
      message: 'An account with this email already exists.',
    });

    const result = await getTestPool().query<{ count: string }>('SELECT count(*) FROM users');
    expect(result.rows[0]?.count).toBe('1');
  });

  it('rejects an invalid email', async () => {
    const response = await registerUser('not-an-email');

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.details).toEqual([
      { path: 'email', message: 'Email must be a valid email address' },
    ]);
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const response = await registerUser('demo@example.com', 'short');

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual([
      { path: 'password', message: 'Password must be at least 8 characters long' },
    ]);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with a valid email and password', async () => {
    await registerUser('demo@example.com');
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@example.com', password: testPassword });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(String),
      name: 'Demo User',
      email: 'demo@example.com',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(cookieHeaderFrom(response).join(';')).toContain(`${AUTH_COOKIE_NAME}=`);
  });

  it('rejects an incorrect password without revealing account existence', async () => {
    await registerUser('demo@example.com');
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@example.com', password: 'WrongPassword123' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Invalid email or password.',
    });
  });

  it('rejects a non-existent email with the same message as an incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: testPassword });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Invalid email or password.',
    });
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const registration = await registerUser('demo@example.com');
    const authCookie = authCookieFrom(registration);
    const response = await request(app).get('/api/auth/me').set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(String),
      name: 'Demo User',
      email: 'demo@example.com',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejects a request without an authentication cookie', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Authentication required.',
    });
  });

  it('rejects an invalid JWT', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=not-a-valid-jwt`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required.');
  });

  it('rejects an expired JWT', async () => {
    const expiredToken = jwt.sign(
      { sub: randomUUID(), exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256' },
    );
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required.');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the authentication cookie', async () => {
    const registration = await registerUser('demo@example.com');
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', authCookieFrom(registration));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'Logged out successfully.',
    });
    expect(cookieHeaderFrom(response).join(';')).toContain(`${AUTH_COOKIE_NAME}=;`);
    expect(cookieHeaderFrom(response).join(';')).toContain('Expires=Thu, 01 Jan 1970 00:00:00');
    expect(cookieHeaderFrom(response).join(';')).toContain('HttpOnly');
    expect(cookieHeaderFrom(response).join(';')).toContain('SameSite=Lax');
    expect(cookieHeaderFrom(response).join(';')).not.toContain('Max-Age');
  });

  it('succeeds without an authentication cookie', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(cookieHeaderFrom(response).join(';')).toContain(`${AUTH_COOKIE_NAME}=;`);
  });
});
