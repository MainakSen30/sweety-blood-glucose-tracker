import type { Request, Response } from 'express';
import { HttpError } from '../../utils/errors.js';
import { formatValidationIssues } from '../../utils/validation.js';
import {
  getDailyReportCached,
  getMonthToDateReportCached,
  getPreviousMonthReportCached,
} from './reports.cache.js';
import { monthlyReportDateQuerySchema, reportDateQuerySchema } from './reports.validation.js';

/**
 * Thin HTTP layer: validate the query string, call the service with the
 * authenticated user's id, and return the report. No SQL, aggregation, or
 * date-range logic lives here.
 */
export async function daily(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedQuery = reportDateQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedQuery.error),
    });
  }

  const report = await getDailyReportCached(userId, parsedQuery.data.date);
  return response.status(200).json(report);
}

export async function monthToDate(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedQuery = reportDateQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedQuery.error),
    });
  }

  const report = await getMonthToDateReportCached(userId, parsedQuery.data.date);
  return response.status(200).json(report);
}

export async function monthly(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedQuery = monthlyReportDateQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedQuery.error),
    });
  }

  const report = await getPreviousMonthReportCached(userId, parsedQuery.data.date);
  return response.status(200).json(report);
}

export function requireUserId(request: Request): string {
  const userId = request.authenticatedUserId;

  if (!userId) {
    throw new HttpError(401, 'Authentication required.');
  }

  return userId;
}
