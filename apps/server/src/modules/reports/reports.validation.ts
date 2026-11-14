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
 * Query string for the previous-month report endpoint. The date is optional;
 * when supplied, it must be a valid calendar date in DD-MM-YYYY format and not
 * in the future (the same validation as daily and month-to-date). When omitted,
 * the service resolves the report relative to today in the application timezone.
 */
export const monthlyReportDateQuerySchema = z.object({
  date: dateOnlySchema.optional(),
});

export type MonthlyReportDateQuery = z.infer<typeof monthlyReportDateQuerySchema>;

/**
 * Body for submitting an asynchronous report-generation job. Daily and
 * month-to-date require their reference date; the previous-month report
 * accepts an optional reference date (falling back to today in Asia/Kolkata).
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
  });

export type ReportJobSubmitBody = z.infer<typeof reportJobSubmitSchema>;
