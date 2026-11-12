import { z } from 'zod';
import { READING_SLOTS } from '../../database/schema.js';
import { isFutureDate, isValidCalendarDate } from '../../utils/date.js';

const VALUE_RANGE_MESSAGE = 'Value must be between 40 and 600 mg/dl.';
const INVALID_DATE_MESSAGE = 'Please enter a valid date.';

/**
 * Validates a date-only string: exact YYYY-MM-DD shape, a real calendar date,
 * and not in the future. Uses a single check so a failing format never also
 * produces the future-date message.
 */
const dateOnlySchema = z.string({ error: INVALID_DATE_MESSAGE }).superRefine((value, ctx) => {
  if (!isValidCalendarDate(value)) {
    ctx.addIssue({ code: 'custom', message: INVALID_DATE_MESSAGE });
    return;
  }

  if (isFutureDate(value)) {
    ctx.addIssue({ code: 'custom', message: 'Date cannot be in the future.' });
  }
});

const valueSchema = z
  .number({ error: 'Please enter a glucose value.' })
  .int({ error: VALUE_RANGE_MESSAGE })
  .min(40, { error: VALUE_RANGE_MESSAGE })
  .max(600, { error: VALUE_RANGE_MESSAGE });

const slotSchema = z.enum(READING_SLOTS, {
  error: 'Slot must be one of morning, after_breakfast, after_lunch, or after_dinner.',
});

export const createReadingSchema = z.object({
  readingDate: dateOnlySchema,
  slot: slotSchema,
  value: valueSchema,
});

export const updateReadingSchema = createReadingSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    error: 'Provide at least one field to update.',
  });

export const listReadingsQuerySchema = z
  .object({
    date: dateOnlySchema.optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .refine(
    (query) => !(query.date !== undefined && (query.from !== undefined || query.to !== undefined)),
    {
      error: 'The date filter cannot be combined with from or to.',
    },
  )
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    error: 'The from date cannot be later than the to date.',
  });

export const readingIdParamSchema = z.uuid({ error: 'Please provide a valid reading id.' });

export type CreateReadingInput = z.infer<typeof createReadingSchema>;
export type UpdateReadingInput = z.infer<typeof updateReadingSchema>;
export type ListReadingsQuery = z.infer<typeof listReadingsQuerySchema>;
