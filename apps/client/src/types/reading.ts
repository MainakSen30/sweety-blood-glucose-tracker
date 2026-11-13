/** The four supported daily reading slots, matching the server enum. */
export type ReadingSlot = 'morning' | 'after_breakfast' | 'after_lunch' | 'after_dinner';

/**
 * A blood glucose reading as returned by the API.
 *
 * `readingDate` is a date-only string in DD-MM-YYYY form. The server stores
 * and sorts on YYYY-MM-DD internally and converts at the API boundary, so no
 * timestamp or timezone conversion can shift the calendar day.
 */
export interface Reading {
  id: string;
  userId: string;
  readingDate: string;
  slot: ReadingSlot;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReadingInput {
  readingDate: string;
  slot: ReadingSlot;
  value: number;
}

export interface UpdateReadingInput {
  readingDate?: string;
  slot?: ReadingSlot;
  value?: number;
}

export interface ListReadingsFilters {
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedReadings {
  data: Reading[];
  pagination: PaginationMetadata;
}

/** Optional labels for UI use; the server also uses these in error messages. */
export const READING_SLOT_LABELS: Record<ReadingSlot, string> = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};
