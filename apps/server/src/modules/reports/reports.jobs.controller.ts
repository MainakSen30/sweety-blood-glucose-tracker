import type { Request, Response } from 'express';
import { HttpError } from '../../utils/errors.js';
import { formatValidationIssues } from '../../utils/validation.js';
import { getReportJobResult, getReportJobStatus, submitReportJob } from '../../jobs/reportQueue.js';
import { requireUserId } from './reports.controller.js';
import { reportJobSubmitSchema } from './reports.validation.js';

/** Express 5 param values can arrive as string or string[]; normalize. */
function jobIdParam(request: Request): string {
  const value: unknown = request.params.jobId;
  return typeof value === 'string' ? value : '';
}

/**
 * Asynchronous report-generation endpoints.
 *
 * The HTTP layer stays thin: validate, delegate to the BullMQ queue module
 * with the authenticated user's id, and map outcomes to status codes.
 * Ownership is enforced against the authenticated identity — job ids are
 * never trusted — and unknown or foreign-owned jobs are 404, matching the
 * readings ownership convention.
 */

/** POST /api/reports/jobs — enqueue a report-generation job. Returns promptly. */
export async function submitReportJobHandler(
  request: Request,
  response: Response,
): Promise<Response> {
  const userId = requireUserId(request);
  const parsedBody = reportJobSubmitSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedBody.error),
    });
  }

  try {
    // The payload sent to the queue carries the authenticated user id only;
    // a client-supplied userId field is never read.
    const submission = await submitReportJob(userId, {
      reportType: parsedBody.data.reportType,
      ...(parsedBody.data.date !== undefined ? { date: parsedBody.data.date } : {}),
    });
    return response.status(202).json(submission);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(503, 'Report queue is unavailable. Please try again later.');
  }
}

/** GET /api/reports/jobs/:jobId — lifecycle status of the caller's own job. */
export async function reportJobStatusHandler(
  request: Request,
  response: Response,
): Promise<Response> {
  const userId = requireUserId(request);
  const jobId = jobIdParam(request);

  try {
    const status = await getReportJobStatus(jobId, userId);

    if (!status) {
      throw new HttpError(404, 'Report job not found.');
    }

    return response.status(200).json(status);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(503, 'Report queue is unavailable. Please try again later.');
  }
}

/** GET /api/reports/jobs/:jobId/result — the report, only once completed. */
export async function reportJobResultHandler(
  request: Request,
  response: Response,
): Promise<Response> {
  const userId = requireUserId(request);
  const jobId = jobIdParam(request);

  try {
    const outcome = await getReportJobResult(jobId, userId);

    if (!outcome) {
      throw new HttpError(404, 'Report job not found.');
    }

    if (outcome.state === 'processing') {
      throw new HttpError(409, 'Report is still being generated.');
    }

    if (outcome.state === 'failed') {
      throw new HttpError(409, 'Report generation failed.');
    }

    return response.status(200).json(outcome.report);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(503, 'Report queue is unavailable. Please try again later.');
  }
}
