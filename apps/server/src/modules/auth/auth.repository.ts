import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../database/index.js';
import { users, type User } from '../../database/schema.js';
import { HttpError } from '../../utils/errors.js';

const BCRYPT_COST_FACTOR = 12;

function isUniqueViolationError(error: unknown): boolean {
  // Drizzle wraps driver errors in a DrizzleQueryError, so the PostgreSQL
  // error code (23505 = unique_violation) may live on the cause.
  const causes: unknown[] = [error];

  let current: unknown = error;
  while (typeof current === 'object' && current !== null && 'cause' in current) {
    current = (current as { cause?: unknown }).cause;
    if (current === null || current === undefined) break;
    causes.push(current);
  }

  return causes.some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'code' in candidate &&
      (candidate as { code?: unknown }).code === '23505',
  );
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);

  return result[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result[0] ?? null;
}

export async function insertUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);

  try {
    const result = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .returning();

    const user = result[0];

    if (!user) {
      throw new Error('User insertion did not return a row.');
    }

    return user;
  } catch (error) {
    if (isUniqueViolationError(error)) {
      throw new HttpError(409, 'An account with this email already exists.');
    }

    throw error;
  }
}
