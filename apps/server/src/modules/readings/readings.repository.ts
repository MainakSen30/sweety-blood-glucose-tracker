import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../database/index.js';
import { readings, type Reading } from '../../database/schema.js';
import { HttpError } from '../../utils/errors.js';
import { isCheckViolationError, isUniqueViolationError } from '../../utils/database-errors.js';
import type { ReadingSlot } from './readings.types.js';
import { duplicateSlotMessage, VALUE_RANGE_MESSAGE } from './readings.messages.js';

export interface ListReadingsFilters {
  date?: string;
  from?: string;
  to?: string;
}

function handleWriteError(error: unknown, slot: ReadingSlot): void {
  if (isUniqueViolationError(error)) {
    throw new HttpError(409, duplicateSlotMessage(slot));
  }

  if (isCheckViolationError(error)) {
    // The Zod schema enforces the range first; this is a defensive mapping so
    // a raw PostgreSQL error can never leak.
    throw new HttpError(400, VALUE_RANGE_MESSAGE);
  }

  throw error;
}

export async function insertReading(input: {
  userId: string;
  readingDate: string;
  slot: ReadingSlot;
  value: number;
}): Promise<Reading> {
  try {
    const result = await db.insert(readings).values(input).returning();
    const reading = result[0];

    if (!reading) {
      throw new Error('Reading insertion did not return a row.');
    }

    return reading;
  } catch (error) {
    handleWriteError(error, input.slot);
    throw error;
  }
}

export async function countReadingsForDate(
  userId: string,
  readingDate: string,
  options: { excludeId?: string } = {},
): Promise<number> {
  const conditions = [eq(readings.userId, userId), eq(readings.readingDate, readingDate)];

  if (options.excludeId) {
    conditions.push(sql`${readings.id} <> ${options.excludeId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(readings)
    .where(and(...conditions));

  return result[0]?.count ?? 0;
}

export async function findReadingById(id: string, userId: string): Promise<Reading | null> {
  const result = await db
    .select()
    .from(readings)
    .where(and(eq(readings.id, id), eq(readings.userId, userId)))
    .limit(1);

  return result[0] ?? null;
}

export async function listReadings(
  userId: string,
  filters: ListReadingsFilters,
  pagination?: { limit: number; offset: number },
): Promise<Reading[]> {
  const baseQuery = db
    .select()
    .from(readings)
    .where(readingsWhere(userId, filters))
    .orderBy(
      desc(readings.readingDate),
      sql`case ${readings.slot}
            when 'morning' then 0
            when 'after_breakfast' then 1
            when 'after_lunch' then 2
            when 'after_dinner' then 3
          end`,
      // date + slot is already unique per user; the id keeps ordering
      // deterministic if that constraint ever changes.
      asc(readings.id),
    );

  if (!pagination) {
    return baseQuery;
  }

  return baseQuery.limit(pagination.limit).offset(pagination.offset);
}

export async function countReadings(userId: string, filters: ListReadingsFilters): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(readings)
    .where(readingsWhere(userId, filters));

  return result[0]?.count ?? 0;
}

/** Shared ownership and filter conditions for the page and count queries. */
function readingsWhere(userId: string, filters: ListReadingsFilters) {
  const conditions = [eq(readings.userId, userId)];

  if (filters.date) {
    conditions.push(eq(readings.readingDate, filters.date));
  }
  if (filters.from) {
    conditions.push(gte(readings.readingDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(readings.readingDate, filters.to));
  }

  return and(...conditions);
}

export async function updateReading(
  id: string,
  userId: string,
  patch: {
    readingDate?: string;
    slot?: ReadingSlot;
    value?: number;
  },
  conflictSlot: ReadingSlot,
): Promise<Reading | null> {
  const updateSet: {
    readingDate?: string;
    slot?: ReadingSlot;
    value?: number;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (patch.readingDate !== undefined) {
    updateSet.readingDate = patch.readingDate;
  }
  if (patch.slot !== undefined) {
    updateSet.slot = patch.slot;
  }
  if (patch.value !== undefined) {
    updateSet.value = patch.value;
  }

  try {
    const result = await db
      .update(readings)
      .set(updateSet)
      .where(and(eq(readings.id, id), eq(readings.userId, userId)))
      .returning();

    return result[0] ?? null;
  } catch (error) {
    handleWriteError(error, conflictSlot);
    throw error;
  }
}

export async function deleteReading(id: string, userId: string): Promise<Reading | null> {
  const result = await db
    .delete(readings)
    .where(and(eq(readings.id, id), eq(readings.userId, userId)))
    .returning();

  return result[0] ?? null;
}
