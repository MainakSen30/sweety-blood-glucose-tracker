import type { ReadingSlot } from './readings.types.js';
import { SLOT_LABELS, slotArticle } from './readings.types.js';

export const VALUE_RANGE_MESSAGE = 'Value must be between 40 and 600 mg/dl.';

export const DAILY_LIMIT_MESSAGE = 'You can add only 4 readings per day.';

export function duplicateSlotMessage(slot: ReadingSlot): string {
  return `You already have ${slotArticle(slot)} ${SLOT_LABELS[slot]} reading for this date.`;
}
