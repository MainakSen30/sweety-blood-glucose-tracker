import { UnrecoverableError } from 'bullmq';
import {
  getDailyReportCached,
  getMonthToDateReportCached,
  getPreviousMonthReportCached,
} from '../modules/reports/reports.cache.js';
import { isDoctorAuthorizedForPatient } from '../modules/access/access.service.js';
import { reportJobPayloadSchema, type ReportJobPayload } from './reportQueue.js';
import type { AsyncReportResult } from './reportQueue.js';

/**
 * Report-generation processor, run by the dedicated BullMQ worker process.
 *
 * The processor owns no report logic: it validates the payload, reports the
 * two meaningful progress stages, and delegates to the existing (cached)
 * report wrappers — PostgreSQL stays the source of truth and report
 * calculation stays in the reporting service.
 *
 * Errors are never swallowed:
 * - A structurally invalid payload is permanent → `UnrecoverableError` fails
 *   the job immediately without burning retries.
 * - Anything else (PostgreSQL failure, unexpected error) propagates so
 *   BullMQ applies the configured retry policy.
 */

/** Structural subset of a BullMQ Job — keeps the processor unit-testable. */
export interface ReportJobLike {
  data: unknown;
  updateProgress(progress: number | object): Promise<void>;
}

export async function processReportJob(job: ReportJobLike): Promise<AsyncReportResult> {
  const startedAt = Date.now();
  let payload: ReportJobPayload;

  try {
    payload = reportJobPayloadSchema.parse(job.data);
  } catch {
    throw new UnrecoverableError('Invalid report job payload.');
  }

  // Consent can be revoked between submission and processing. A dead
  // relationship is permanent, so the job must not burn retries.
  if (
    payload.requestedBy !== undefined &&
    !(await isDoctorAuthorizedForPatient(payload.requestedBy, payload.userId))
  ) {
    throw new UnrecoverableError('Doctor access to this patient is no longer active.');
  }

  console.log(
    `[report-worker] job processing ${payload.reportType} report (userId ${payload.userId}).`,
  );
  // Stage 1: job accepted and validated.
  await job.updateProgress(10);

  // Stage 2: fetch + build the report from PostgreSQL (through the cache).
  await job.updateProgress(50);

  const report =
    payload.reportType === 'daily'
      ? await getDailyReportCached(payload.userId, payload.date!, payload.requestedBy)
      : payload.reportType === 'month-to-date'
        ? await getMonthToDateReportCached(payload.userId, payload.date!, payload.requestedBy)
        : await getPreviousMonthReportCached(payload.userId, payload.requestedBy);

  console.log(
    `[report-worker] report generated in ${Date.now() - startedAt}ms (${payload.reportType}).`,
  );
  return report;
}
