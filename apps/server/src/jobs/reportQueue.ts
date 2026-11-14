import { Queue, Worker, type Job, type JobProgress, type JobState } from 'bullmq';
import type { RedisOptions } from 'bullmq';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/errors.js';
import { processReportJob } from './reportProcessor.js';
import type { DailyReport, PeriodReport } from '../modules/reports/reports.types.js';

/**
 * BullMQ infrastructure for asynchronous report generation.
 *
 * The Express API only talks to the queue (submit / status / result); a
 * separate worker process runs the actual generation. BullMQ gets its own
 * Redis connections built from `REDIS_URL` — its blocking connections require
 * `maxRetriesPerRequest: null`, which is incompatible with the fail-fast
 * report-cache client, so BullMQ never reuses that instance.
 *
 * Key separation: BullMQ keys live under `sweety:jobs:*` while report-cache
 * keys live under `sweety:v1:*`. Invalidation never deletes queue data
 * (it only increments a user version counter).
 */

export const REPORT_QUEUE_NAME = 'report-generation';
export const REPORT_QUEUE_PREFIX = 'sweety:jobs';
/** Conservative concurrency: report generation is a single indexed query. */
export const REPORT_WORKER_CONCURRENCY = 2;

export type AsyncReportResult = DailyReport | PeriodReport;

/**
 * Minimal job payload. The user id always originates from the authenticated
 * server-side identity — never from the request body of a client.
 */
export const reportJobPayloadSchema = z
  .object({
    userId: z.string().min(1),
    reportType: z.enum(['daily', 'month-to-date', 'monthly']),
    /** Internal YYYY-MM-DD reference date; monthly reports derive their period instead. */
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.reportType !== 'monthly' && payload.date === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Report job payload is missing its date.' });
    }
  });

export interface ReportJobPayload {
  userId: string;
  reportType: 'daily' | 'month-to-date' | 'monthly';
  date?: string;
}

/** Expiry for finished jobs (completed results and failure records alike). */
function retentionAgeSeconds(): number {
  return env.REPORT_JOB_RETENTION_SECONDS;
}

/** Retry + retention policy applied to every submitted report job. */
export function buildReportJobOptions() {
  return {
    attempts: env.REPORT_JOB_ATTEMPTS,
    backoff: { type: 'exponential' as const, delay: env.REPORT_JOB_BACKOFF_MS },
    removeOnComplete: { age: retentionAgeSeconds() },
    removeOnFail: { age: retentionAgeSeconds() },
  };
}

/**
 * Dedicated BullMQ connection options. `maxRetriesPerRequest: null` is a
 * BullMQ requirement for its blocking connections; `url` lets BullMQ build
 * the connections itself (one per Queue/Worker instance).
 */
export function bullmqConnectionOptions(): RedisOptions {
  if (!env.REDIS_URL) {
    throw new HttpError(503, 'Report queue is not configured. Set REDIS_URL to enable it.');
  }

  return { url: env.REDIS_URL, maxRetriesPerRequest: null };
}

let queue: Queue<ReportJobPayload, AsyncReportResult> | null = null;

/** Shared queue instance for the API process; created on first use. */
export function getReportQueue(): Queue<ReportJobPayload, AsyncReportResult> {
  queue ??= new Queue<ReportJobPayload, AsyncReportResult>(REPORT_QUEUE_NAME, {
    prefix: REPORT_QUEUE_PREFIX,
    connection: bullmqConnectionOptions(),
  });
  return queue;
}

/**
 * Deterministic id: duplicate in-flight submissions return the same job.
 * Note: BullMQ custom job IDs cannot contain ":" as colon is BullMQ's key separator.
 */
export function buildReportJobId(
  payload: Omit<ReportJobPayload, 'userId'> & { userId: string },
): string {
  return `rpt_${payload.userId}_${payload.reportType}_${payload.date ?? 'monthly'}`;
}

export interface ReportJobSubmission {
  jobId: string;
  status: string;
}

const IN_FLIGHT_STATES: ReadonlySet<string> = new Set(['waiting', 'delayed', 'active']);

/**
 * Enqueues a report-generation job for an authenticated user.
 *
 * Idempotency: the job id is derived from the authenticated user id and the
 * validated parameters. While such a job is waiting/active, duplicate
 * submissions return that same job instead of queueing a copy. A completed
 * or failed job with the same id is removed first, so a later legitimate
 * request for the same report always regenerates fresh data rather than
 * serving a stale retained result.
 */
export async function submitReportJob(
  userId: string,
  params: { reportType: ReportJobPayload['reportType']; date?: string },
): Promise<ReportJobSubmission> {
  const reportQueue = getReportQueue();
  const payload: ReportJobPayload = { userId, ...params };
  const jobId = buildReportJobId(payload);

  try {
    const existing = await reportQueue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();

      if (IN_FLIGHT_STATES.has(state)) {
        return { jobId, status: state };
      }

      // Completed or failed: drop the retained copy so the new request
      // regenerates. Best-effort — the add below re-creates the id.
      await existing.remove().catch(() => undefined);
    }

    const job = await reportQueue.add('generate', payload, { jobId, ...buildReportJobOptions() });
    return { jobId: job.id ?? jobId, status: await job.getState() };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    // Redis unreachable or queue unavailable: the HTTP request itself is
    // fine, so the client gets a clear retryable error instead of a 500.
    console.error(`Report queue submission failed: ${describeError(error)}`);
    throw new HttpError(503, 'Report queue is unavailable. Please try again later.');
  }
}

/**
 * Fetches a job only when it belongs to `userId`. Job ids are never trusted
 * as authorization — ownership lives in the payload's server-side user id.
 * Returns `null` for unknown or foreign-owned jobs (callers respond 404).
 */
export async function findOwnedReportJob(
  jobId: string,
  userId: string,
): Promise<Job<ReportJobPayload, AsyncReportResult> | null> {
  try {
    const job = await getReportQueue().getJob(jobId);

    if (!job || job.data.userId !== userId) {
      return null;
    }

    return job;
  } catch (error) {
    console.error(`Report queue lookup failed: ${describeError(error)}`);
    throw new HttpError(503, 'Report queue is unavailable. Please try again later.');
  }
}

export interface ReportJobStatusDto {
  jobId: string;
  status: JobState | 'unknown';
  /** Last reported progress (our stages: 10 accepted, 50 generating). */
  progress: JobProgress | null;
  /** Present only for failed jobs; safe, message-level detail. */
  failedReason?: string;
}

/** Status DTO for `GET /jobs/:jobId`; `null` becomes a 404 upstream. */
export async function getReportJobStatus(
  jobId: string,
  userId: string,
): Promise<ReportJobStatusDto | null> {
  const job = await findOwnedReportJob(jobId, userId);

  if (!job) {
    return null;
  }

  return {
    jobId: job.id ?? jobId,
    status: await job.getState(),
    progress: job.progress ?? null,
    ...(job.failedReason ? { failedReason: job.failedReason } : {}),
  };
}

export type ReportJobResultOutcome =
  | { state: 'completed'; report: AsyncReportResult }
  | { state: 'processing' }
  | { state: 'failed'; reason: string };

/**
 * Result outcome for `GET /jobs/:jobId/result`; `null` becomes a 404, the
 * processing/failed states become 409s, and only `completed` returns the
 * report payload.
 */
export async function getReportJobResult(
  jobId: string,
  userId: string,
): Promise<ReportJobResultOutcome | null> {
  const job = await findOwnedReportJob(jobId, userId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  if (state === 'completed') {
    return { state: 'completed', report: job.returnvalue };
  }

  if (state === 'failed') {
    return { state: 'failed', reason: job.failedReason ?? 'Report generation failed.' };
  }

  return { state: 'processing' };
}

/**
 * Creates the report worker for the dedicated worker process. The worker
 * owns its own blocking BullMQ connection; lifecycle logging lives in the
 * event handlers (ids and durations only — never report payloads).
 */
export function createReportWorker(): Worker<ReportJobPayload, AsyncReportResult> {
  const worker = new Worker<ReportJobPayload, AsyncReportResult>(
    REPORT_QUEUE_NAME,
    processReportJob,
    {
      prefix: REPORT_QUEUE_PREFIX,
      connection: bullmqConnectionOptions(),
      concurrency: REPORT_WORKER_CONCURRENCY,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[report-worker] job ${job.id} completed (attempt ${job.attemptsMade}).`);
  });

  worker.on('failed', (job, error) => {
    const attempt = job ? `${job.attemptsMade}` : '?';
    console.error(
      `[report-worker] job ${job?.id ?? '?'} failed on attempt ${attempt}: ${error.message}`,
    );
  });

  worker.on('error', (error) => {
    // Emitted for connection issues too; logged, never fatal.
    console.error(`[report-worker] worker error: ${error.message}`);
  });

  return worker;
}

/** Closes the shared queue during graceful shutdown; safe when never used. */
export async function closeReportQueue(): Promise<void> {
  if (queue) {
    await queue.close().catch(() => undefined);
    queue = null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
