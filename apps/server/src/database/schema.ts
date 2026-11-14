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
export const USER_ROLES = ['patient', 'doctor'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleEnum = pgEnum('user_role', USER_ROLES);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    /**
     * Public registration always creates `patient` accounts. Doctors are
     * provisioned only through the guarded `promote-doctor` CLI, which records
     * the change in `user_role_changes`.
     */
    role: userRoleEnum('role').notNull().default('patient'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_email_unique_index').on(sql`lower(${table.email})`),
    index('users_role_index').on(table.role),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const ASSIGNMENT_STATUSES = ['pending', 'active', 'revoked', 'rejected', 'expired'] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const assignmentStatusEnum = pgEnum('doctor_patient_assignment_status', ASSIGNMENT_STATUSES);

/**
 * Patient-controlled doctor authorization.
 *
 * Each row is one invitation/relationship lifecycle. Accepting a pending row
 * makes it `active`; revoking keeps the history and sets `revoked`. Partial
 * unique indexes allow at most one pending and one active row per pair, while
 * historical revoked/rejected/expired rows remain stored.
 *
 * Only a SHA-256 hash of the invitation token is stored. The plaintext token
 * is returned once to the inviting doctor and never logged.
 */
export const doctorPatientAssignments = pgTable(
  'doctor_patient_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: assignmentStatusEnum('status').notNull().default('pending'),
    tokenHash: varchar('token_hash', { length: 64 }),
    invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'doctor_patient_assignments_distinct_check',
      sql`${table.doctorId} <> ${table.patientId}`,
    ),
    uniqueIndex('doctor_patient_assignments_active_unique_index')
      .on(table.doctorId, table.patientId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex('doctor_patient_assignments_pending_unique_index')
      .on(table.doctorId, table.patientId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex('doctor_patient_assignments_token_hash_unique_index')
      .on(table.tokenHash)
      .where(sql`${table.tokenHash} is not null`),
    index('doctor_patient_assignments_doctor_status_index').on(table.doctorId, table.status),
    index('doctor_patient_assignments_patient_status_index').on(table.patientId, table.status),
  ],
);

export type DoctorPatientAssignment = typeof doctorPatientAssignments.$inferSelect;
export type NewDoctorPatientAssignment = typeof doctorPatientAssignments.$inferInsert;

/** Append-only audit trail for role changes made by a trusted operator. */
export const userRoleChanges = pgTable(
  'user_role_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    previousRole: userRoleEnum('previous_role').notNull(),
    newRole: userRoleEnum('new_role').notNull(),
    changedBy: varchar('changed_by', { length: 120 }).notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('user_role_changes_user_changed_index').on(table.userId, table.changedAt)],
);

export type UserRoleChange = typeof userRoleChanges.$inferSelect;

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
