/** The four supported daily reading slots, matching the server enum. */
export type ReadingSlot = 'morning' | 'after_breakfast' | 'after_lunch' | 'after_dinner';

/**
 * A blood glucose reading as returned by the API.
 *
 * `readingDate` is a date-only string (YYYY-MM-DD); the server never converts
 * it to a timestamp so calendar-day semantics survive the trip.
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
}

/** Optional labels for UI use; the server also uses these in error messages. */
export const READING_SLOT_LABELS: Record<ReadingSlot, string> = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};
