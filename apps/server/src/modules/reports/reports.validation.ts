import { z } from 'zod';
import { dateOnlySchema } from '../readings/readings.validation.js';

/**
 * Query string for the daily and month-to-date report endpoints. The date is
 * required, must be a real DD-MM-YYYY calendar date, and must not be in the
 * future — the exact same rules the readings endpoints apply.
 */
export const reportDateQuerySchema = z.object({
  date: dateOnlySchema,
});

export type ReportDateQuery = z.infer<typeof reportDateQuerySchema>;
