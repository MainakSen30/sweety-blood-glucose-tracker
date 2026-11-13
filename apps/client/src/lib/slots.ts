import { READING_SLOT_LABELS, type ReadingSlot } from '../types/reading.js';

/** The four daily slots in chronological order. */
export const SLOT_ORDER: ReadingSlot[] = [
  'morning',
  'after_breakfast',
  'after_lunch',
  'after_dinner',
];

/** Short labels for compact surfaces (the rhythm strip, chart axes). */
export const SLOT_SHORT_LABELS: Record<ReadingSlot, string> = {
  morning: 'Morning',
  after_breakfast: 'Breakfast',
  after_lunch: 'Lunch',
  after_dinner: 'Dinner',
};

export function slotLabel(slot: ReadingSlot): string {
  return READING_SLOT_LABELS[slot];
}

export function slotShortLabel(slot: ReadingSlot): string {
  return SLOT_SHORT_LABELS[slot];
}
