# Phase 12 — BullMQ Background Jobs & Asynchronous Report Generation

**Repository:** `MainakSen30/sweety-blood-glucose-tracker`
**Phase:** 12 — Distributed Asynchronous Report Processing
**Status:** Complete & Verified

---

## A. Executive Summary

Phase 12 introduces **BullMQ** and a dedicated worker process to the SWEETy Blood Glucose Tracker to support reliable, non-blocking asynchronous report generation.

Prior to Phase 12, report generation (daily summaries, month-to-date aggregates, and previous-month calculations) was executed synchronously within Express HTTP request lifecycles. While Redis report caching (introduced in Phase 11) reduced database read pressure on repeated requests, calculating large periods or computing cache misses could block HTTP server resources.

### Implemented Workflow
1. **Asynchronous Request:** An authenticated user requests report generation via `POST /api/reports/jobs`.
2. **Server-Side Authorization:** Express validates the request payload and binds the server-authenticated user identity (`request.authenticatedUserId`). A client-supplied `userId` is never trusted.
3. **Queue Submission:** Express submits a job to the `report-generation` BullMQ queue and immediately returns `202 Accepted` with the deterministic job ID and initial status (`waiting` or `active`).
4. **Worker Processing:** A dedicated background worker process (running independently of the Express API in its own Docker container / process) picks up the job.
5. **Authoritative Calculation:** The worker loads data from PostgreSQL, utilizing existing report service calculation logic and the Redis report cache.
6. **Progress Tracking:** The worker reports granular lifecycle progress stages (10% validated, 50% computing).
7. **Status & Result Polling:** The client polls `GET /api/reports/jobs/:jobId` and, upon completion, retrieves the report payload via `GET /api/reports/jobs/:jobId/result`.
8. **Ownership Enforcement:** A user can only inspect or retrieve jobs they own; requests for another user's job or non-existent job return `404 Not Found`.
9. **Bounded Retention:** Completed and failed job results are purged from Redis after `REPORT_JOB_RETENTION_SECONDS` (default: 3600 seconds / 1 hour), ensuring personal health data is not stored indefinitely in cache storage.

### Overall Readiness
- All 16 server test suites (281 tests) and 10 client test suites (96 tests) pass cleanly (377 total passing tests).
- End-to-end runtime verification performed on Docker Compose: PostgreSQL, Redis, Express API, Vite Client, and the new BullMQ Worker service were verified live with job submission, execution, progress tracking, result retrieval, and foreign-user access rejection.

---

## B. Existing Architecture

### Redis Integration
- Reuses the existing Redis 7 deployment from Phase 11.
- Redis serves dual logical purposes:
  1. **Report Cache:** Keyed under `sweety:v1:reports:*` and `sweety:v1:user-version:*`. Configured with `enableOfflineQueue: false` and `commandTimeout: 1000ms` for fail-fast cache-aside reads.
  2. **BullMQ Queues:** Keyed under `sweety:jobs:*`. BullMQ uses dedicated blocking Redis connections with `maxRetriesPerRequest: null`.
- **Key Separation:** Invalidation of report cache entries (via user version bumping) never removes or corrupts BullMQ queue data.

### Reporting Architecture
- Existing calculation logic in `apps/server/src/modules/reports/reports.service.ts` and cached wrappers in `reports.cache.ts` remain the single source of truth.
- Database aggregations (`MAX`, `MIN`, `AVG`, `COUNT`) are executed in PostgreSQL across indexed `(user_id, reading_date)` columns.
- Synchronous reporting endpoints (`GET /api/reports/daily`, `GET /api/reports/month-to-date`, `GET /api/reports/monthly`) continue functioning without interruption.

### API Structure
- Express 5 REST API using JSON payloads and cookie-based JWT authentication.
- Standardized error format `{ status: 'error', message: string, details?: Array }`.
- Zod schemas validate user-facing inputs (`DD-MM-YYYY` calendar dates, non-future dates).

---

## C. Queue Architecture

### Configuration
- **Queue Name:** `report-generation`
- **Key Prefix:** `sweety:jobs`
- **Concurrency:** Conservative concurrency of **2** (`REPORT_WORKER_CONCURRENCY = 2`) to ensure background work does not starve PostgreSQL connection pools or CPU cores.
- **Worker Process:** Dedicated script entry point `apps/server/src/worker.ts`, launched via `npm run dev:worker` (development) or `node dist/worker.js` (production).

### Redis Connection Strategy
BullMQ requires `maxRetriesPerRequest: null` for blocking commands (`BRPOPLPUSH`, `BLMOVE`, etc.). Because the Phase 11 report-cache client was explicitly configured with `maxRetriesPerRequest: 1` and `enableOfflineQueue: false` for fail-fast degraded operation, BullMQ creates its own dedicated connections from `REDIS_URL`:

```typescript
export function bullmqConnectionOptions(): RedisOptions {
  if (!env.REDIS_URL) {
    throw new HttpError(503, 'Report queue is not configured. Set REDIS_URL to enable it.');
  }
  return { url: env.REDIS_URL, maxRetriesPerRequest: null };
}
```

### Job Payload
Minimal Zod-validated payload schema:
```typescript
export interface ReportJobPayload {
  userId: string;
  reportType: 'daily' | 'month-to-date' | 'monthly';
  date?: string; // Internal YYYY-MM-DD reference date
}
```

---

## D. API Design

### 1. Submit Report Job
- **Route:** `POST /api/reports/jobs`
- **Auth:** Required (HTTP-only JWT cookie)
- **Request Body:**
  ```json
  {
    "reportType": "daily",
    "date": "15-01-2026"
  }
  ```
- **Validation:**
  - `reportType` must be one of `daily`, `month-to-date`, `monthly`.
  - `date` required for `daily` and `month-to-date` in valid `DD-MM-YYYY` format (non-future).
  - `date` forbidden for `monthly`.
  - Body `userId` is ignored; server always assigns authenticated user ID.
- **Success Response:** `202 Accepted`
  ```json
  {
    "jobId": "rpt_user-uuid_daily_2026-01-15",
    "status": "waiting"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Validation failure.
  - `401 Unauthorized`: Unauthenticated.
  - `503 Service Unavailable`: Redis unavailable.

### 2. Retrieve Job Status
- **Route:** `GET /api/reports/jobs/:jobId`
- **Auth:** Required
- **Ownership:** Verified by checking `job.data.userId === request.authenticatedUserId`. Foreign jobs return `404 Not Found`.
- **Success Response:** `200 OK`
  ```json
  {
    "jobId": "rpt_user-uuid_daily_2026-01-15",
    "status": "active",
    "progress": 50
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Unauthenticated.
  - `404 Not Found`: Unknown or foreign-owned job ID.
  - `503 Service Unavailable`: Redis unavailable.

### 3. Retrieve Report Result
- **Route:** `GET /api/reports/jobs/:jobId/result`
- **Auth:** Required
- **Ownership:** Verified against authenticated identity. Foreign jobs return `404 Not Found`.
- **Success Response:** `200 OK`
  ```json
  {
    "reportType": "daily",
    "date": "15-01-2026",
    "summary": { "highest": 140, "lowest": 90, "average": 115.0, "totalReadings": 2 },
    "readings": [ ... ]
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Unauthenticated.
  - `404 Not Found`: Unknown or foreign-owned job ID.
  - `409 Conflict`: Job is still processing (`"Report is still being generated."`) or failed (`"Report generation failed."`).
  - `503 Service Unavailable`: Redis unavailable.

---

## E. Job Lifecycle

```
[ POST /api/reports/jobs ]
          │
          ▼
   (Deterministic ID) ──► Is Job Active/Waiting? ──YES──► Return existing Job ID (202)
          │ NO
          ▼
   Enqueue Job ──► State: "waiting" ──► (202 Accepted)
          │
          ▼ (Worker picks up job)
   State: "active"
   Stage 1: Validated (Progress 10%)
   Stage 2: Calculating from PostgreSQL (Progress 50%)
          │
   ┌──────┴────────────────────────┐
   ▼                               ▼
Success                          Failure
   │                               │
State: "completed"               Permanent Error? ──YES──► UnrecoverableError (No retry)
Result saved in BullMQ             │ NO
Auto-removed after TTL (3600s)   Retry with Exponential Backoff (attempts <= 3)
                                   │ Max retries exceeded
                                 State: "failed" (Reason saved, auto-removed after 3600s)
```

1. **Submission:** Derives deterministic ID `rpt_<userId>_<reportType>_<date|'monthly'>`.
2. **Processing:** Worker validates payload with Zod.
3. **Progress Updates:** Real BullMQ progress emitted at stage 10 and stage 50.
4. **Completion:** Returns pure report DTO directly to BullMQ return value.
5. **Failure & Retry:**
   - Invalid payloads throw `UnrecoverableError`, aborting immediately without burning retries.
   - Database/transient connection errors retry up to 3 times with exponential backoff (`delay: 1000ms * 2^attempt`).
6. **Retention:** Configured with `removeOnComplete: { age: 3600 }` and `removeOnFail: { age: 3600 }`.

---

## F. Reliability and Security

### Idempotency
Custom BullMQ job IDs follow:
```
rpt_<userId>_<reportType>_<date|'monthly'>
```
*(Note: Colon `:` is avoided because BullMQ reserves `:` for its key namespace delimiters and throws `Custom Id cannot contain :`.)*

- **In-Flight Deduplication:** If an identical report request is already `waiting`, `active`, or `delayed`, `submitReportJob` returns the existing job ID and state rather than enqueuing redundant calculations.
- **Post-Completion Regeneration:** If a finished (`completed` or `failed`) job exists with the same ID, it is cleared before adding the new job, ensuring that legitimate subsequent requests recompute fresh data from PostgreSQL.

### User Isolation & Authorization
- Ownership is verified at the queue module level:
  ```typescript
  if (!job || job.data.userId !== userId) {
    return null; // mapped to 404 Not Found upstream
  }
  ```
- No user can discover the existence, status, or contents of another user's job.

### Sensitive Data Handling
- Health readings and report results are **never logged** in console or server/worker logs.
- Worker logs record only metadata: `[report-worker] job processing daily report (userId <uuid>)` and `[report-worker] report generated in 14ms`.
- Job results are stored exclusively in Redis with TTL expiration. PostgreSQL does not persist disposable job payloads.

### Redis Failure Behavior
- If Redis is unreachable when enqueuing or polling jobs, the API responds with `503 Service Unavailable` (`HttpError(503)`).
- The rest of the SWEETy API (readings CRUD, auth, and synchronous PostgreSQL reports) continues to operate.

### Graceful Shutdown
The worker handles `SIGTERM` and `SIGINT`:
1. Halts accepting new jobs from BullMQ.
2. Awaits completion of in-flight processing jobs.
3. Closes BullMQ Worker and Queue instances.
4. Closes Redis and PostgreSQL pools.
5. Employs a 10-second safety timeout before forced exit.

---

## G. Docker Integration

### Compose Service
Added `worker` to `docker-compose.yml`:
```yaml
  worker:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
      target: development
    command: ['npm', 'run', 'dev:worker', '--workspace', '@sweety/server']
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${POSTGRES_USER:-sweety}:${POSTGRES_PASSWORD:-sweety_dev_password}@postgres:5432/${POSTGRES_DB:-sweety}
      JWT_SECRET: ${JWT_SECRET:?...}
      REDIS_URL: ${REDIS_URL:-redis://redis:6379}
      REDIS_CACHE_TTL_SECONDS: ${REDIS_CACHE_TTL_SECONDS:-60}
      REPORT_JOB_ATTEMPTS: ${REPORT_JOB_ATTEMPTS:-3}
      REPORT_JOB_BACKOFF_MS: ${REPORT_JOB_BACKOFF_MS:-1000}
      REPORT_JOB_RETENTION_SECONDS: ${REPORT_JOB_RETENTION_SECONDS:-3600}
    volumes:
      - ./apps/server/src:/app/apps/server/src
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    init: true
    networks:
      - sweety-network
```

- Worker connects to PostgreSQL and Redis using internal service hostnames (`postgres:5432`, `redis:6379`).
- Exposes no public host ports.
- Health dependency gates worker start until PostgreSQL and Redis are healthy.

---

## H. Frontend Integration

### UI Components & State Management
- Updated `apps/client/src/pages/ReportsPage.tsx`:
  - Added "Generate in background" button with loading and disabled states.
  - Added background job status banner matching the cream and olive design system.
  - Displays Job ID, status badges (`Queued (waiting)`, `Processing`, `Completed`, `Failed`), and progress percentage.
  - Dismiss button allows clearing the notice once completed or failed.
- Typed client API functions in `apps/client/src/services/reportsApi.ts`:
  - `submitReportJob`
  - `getReportJobStatus`
  - `getReportJobResult`

### Polling Behavior
- Polling interval set to 1000ms while status is `waiting` or `active`.
- Automatically retrieves report result and updates local charts when `completed`.
- Automatically terminates polling on `completed` or `failed`.
- Cleans up active polling intervals on component unmount or tab switch.

---

## I. Testing Results

| Test category | Result | Details |
|---|---|---|
| Queue submission | **PASS** | Validates authenticated user ID, Zod payload validation, date format checks, non-future dates, returns 202 Accepted. |
| Job processing | **PASS** | Tested in `reportProcessor.test.ts` against PostgreSQL with cached wrappers; verified daily, MTD, and monthly generation. |
| Progress tracking | **PASS** | Worker reports stage 10 (validated) and stage 50 (computed); reflected in status API. |
| Job ownership | **PASS** | User A cannot view User B's job or result; returns 404 Not Found for foreign jobs. |
| Result retrieval | **PASS** | Returns 409 when processing/failed, returns 200 with report payload when completed. |
| Retry behavior | **PASS** | Configured for 3 attempts with exponential backoff; transient db errors trigger retry, unrecoverable payload errors fail fast. |
| Redis failure | **PASS** | Gracefully degrades to 503 Service Unavailable when Redis is unreachable during queue operations. |
| Database failure | **PASS** | Propagated as retryable errors in processor tests. |
| Job retention | **PASS** | BullMQ configured with `removeOnComplete` and `removeOnFail` bounded by `REPORT_JOB_RETENTION_SECONDS` (3600s). |
| Frontend integration | **PASS** | 5 tests in `ReportsPage.async.test.tsx` verify submission, polling, progress updates, chart rendering, and error dismissal. |
| Existing backend tests | **PASS** | All 16 backend test suites pass (281 tests passed, 0 failed). |
| Existing frontend tests | **PASS** | All 10 frontend test suites pass (96 tests passed, 0 failed). |

### Monorepo Test Summary
- **Total Test Suites:** 26 passed (26 total)
- **Total Tests:** 377 passed (377 total)
- **Linter Status:** 0 errors, 0 warnings (`npm run lint`)
- **Typecheck Status:** 0 errors across client and server (`npm run typecheck`)
- **Formatting Status:** 100% compliant (`npm run format:check`)

---

## J. Files Changed

| File | Purpose |
|---|---|
| `apps/server/package.json` | Added `bullmq` dependency and `"dev:worker"`, `"start:worker"` scripts. |
| `package.json` | Added `"dev:worker"` workspace proxy script. |
| `.env.example` | Added BullMQ configuration: `REPORT_JOB_ATTEMPTS`, `REPORT_JOB_BACKOFF_MS`, `REPORT_JOB_RETENTION_SECONDS`. |
| `apps/server/src/config/env.ts` | Zod schema validation for new BullMQ environment variables. |
| `apps/server/src/jobs/reportQueue.ts` | Centralized queue configuration, job submission, status/result lookups, worker creation, and shutdown. |
| `apps/server/src/jobs/reportProcessor.ts` | Background job processor function integrating report caching and progress updates. |
| `apps/server/src/jobs/reportQueue.test.ts` | Unit tests for BullMQ queue submission, idempotency, ownership, and options. |
| `apps/server/src/jobs/reportProcessor.test.ts` | Integration tests for worker job processing against PostgreSQL and cache. |
| `apps/server/src/worker.ts` | Dedicated worker process entry point with connection verification and graceful shutdown handlers. |
| `apps/server/src/modules/reports/reports.controller.ts` | Exported `requireUserId` helper for reuse in job controllers. |
| `apps/server/src/modules/reports/reports.jobs.controller.ts` | HTTP route handlers for `POST /jobs`, `GET /jobs/:jobId`, and `GET /jobs/:jobId/result`. |
| `apps/server/src/modules/reports/reports.jobs.routes.test.ts` | Comprehensive Supertest route tests covering auth, validation, ownership, and errors. |
| `apps/server/src/modules/reports/reports.routes.ts` | Wired asynchronous report job endpoints into reports router. |
| `apps/server/src/modules/reports/reports.validation.ts` | Zod validation schemas for report job submissions. |
| `apps/server/src/server.ts` | Added `closeReportQueue()` to graceful shutdown sequence. |
| `docker-compose.yml` | Added dedicated `worker` service. |
| `apps/client/src/types/report.ts` | Added `ReportJobSubmission`, `ReportJobStatus`, and `ReportJobSubmitRequest` interfaces. |
| `apps/client/src/services/reportsApi.ts` | Added `submitReportJob`, `getReportJobStatus`, and `getReportJobResult` client methods. |
| `apps/client/src/pages/ReportsPage.tsx` | Added background report generation button, job banner, progress indicators, and polling effect. |
| `apps/client/src/pages/ReportsPage.async.test.tsx` | RTL test suite verifying async job UI, status updates, completion rendering, and error handling. |
| `README.md` | Documented BullMQ background job architecture, Docker reviewer commands, and environment variables. |

---

## K. Remaining Limitations

1. **Single Priority Queue:** All report jobs currently share a single queue with FIFO scheduling. Job priority tiers (e.g. daily reports prioritized over multi-month historical calculations) can be added in future iterations if workload expands.
2. **In-Memory Rate Limiting:** The job submission endpoint relies on the existing Express IP-based rate limiter; a distributed Redis token-bucket rate limiter could be introduced if multi-instance API deployments are deployed.
3. **Doctor / Patient Roles:** Doctor roles and delegated patient report exports are deferred to Phase 13 per project specifications.
