import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Application users.
 *
 * This table is the owner of future user-scoped records such as glucose readings.
 * Email uniqueness is enforced case-insensitively with a functional unique index.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_email_unique_index').on(sql`lower(${table.email})`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** The four daily reading slots, in chronological order. */
export const READING_SLOTS = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'] as const;

export type ReadingSlot = (typeof READING_SLOTS)[number];

export const readingSlotEnum = pgEnum('reading_slot', READING_SLOTS);

/**
 * Blood glucose readings.
 *
 * `readingDate` is a PostgreSQL DATE (date-only); it is always handled as a
 * `YYYY-MM-DD` string and never converted through JavaScript timestamps, so
 * timezone shifts cannot change the calendar day.
 */
export const readings = pgTable(
  'readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readingDate: date('reading_date').notNull(),
    slot: readingSlotEnum('slot').notNull(),
    value: integer('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('readings_user_date_slot_unique_index').on(
      table.userId,
      table.readingDate,
      table.slot,
    ),
    index('readings_user_date_index').on(table.userId, table.readingDate),
    check('readings_value_range_check', sql`${table.value} BETWEEN 40 AND 600`),
  ],
);

export type Reading = typeof readings.$inferSelect;
export type NewReading = typeof readings.$inferInsert;
