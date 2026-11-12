import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../database/index.js';
import { users, type User } from '../../database/schema.js';
import { HttpError } from '../../utils/errors.js';
import { isUniqueViolationError } from '../../utils/database-errors.js';

const BCRYPT_COST_FACTOR = 12;

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
