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

/**
 * Body for submitting an asynchronous report-generation job. Daily and
 * month-to-date require their reference date; the previous-month report
 * derives its period from today in Asia/Kolkata and takes no date.
 */
export const reportJobSubmitSchema = z
  .object({
    reportType: z.enum(['daily', 'month-to-date', 'monthly'], {
      error: 'reportType must be one of daily, month-to-date, or monthly.',
    }),
    date: dateOnlySchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.reportType !== 'monthly' && body.date === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'A report date is required for daily and month-to-date reports.',
      });
    }

    if (body.reportType === 'monthly' && body.date !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'The previous-month report takes no date.',
      });
    }
  });

export type ReportJobSubmitBody = z.infer<typeof reportJobSubmitSchema>;
