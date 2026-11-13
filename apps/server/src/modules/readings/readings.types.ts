import type { READING_SLOTS, ReadingSlot as DatabaseReadingSlot } from '../../database/schema.js';
import { toDDMMYYYY } from '../../utils/date.js';

export type ReadingSlot = (typeof READING_SLOTS)[number];

/** Human-readable slot labels used in error messages. */
export const SLOT_LABELS: Record<ReadingSlot, string> = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

/** Slot order used for sorting: morning, after_breakfast, after_lunch, after_dinner. */
export const SLOT_ORDER: Record<ReadingSlot, number> = {
  morning: 0,
  after_breakfast: 1,
  after_lunch: 2,
  after_dinner: 3,
};

/**
 * API shape of a reading. `readingDate` is a date-only string in DD-MM-YYYY
 * form (the API format); the database stores YYYY-MM-DD internally.
 */
export interface ReadingDto {
  id: string;
  userId: string;
  readingDate: string;
  slot: ReadingSlot;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedReadingsDto {
  data: ReadingDto[];
  pagination: PaginationMetadata;
}

export function toReadingDto(reading: {
  id: string;
  userId: string;
  readingDate: string;
  slot: DatabaseReadingSlot;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}): ReadingDto {
  return {
    id: reading.id,
    userId: reading.userId,
    readingDate: toDDMMYYYY(reading.readingDate),
    slot: reading.slot,
    value: reading.value,
    createdAt: reading.createdAt,
    updatedAt: reading.updatedAt,
  };
}

/** "a"/"an" for the slot label in duplicate messages. */
export function slotArticle(slot: ReadingSlot): string {
  return /^(a|e|i|o|u)/i.test(SLOT_LABELS[slot]) ? 'an' : 'a';
}
