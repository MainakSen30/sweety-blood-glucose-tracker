# Phase 13 — Patient and Doctor Roles

**Repository:** `MainakSen30/sweety-blood-glucose-tracker`
**Phase:** 13 — Patient-consented doctor access and role-based authorization
**Status:** Complete & verified

---

## A. Executive Summary

Phase 13 introduces two application roles — `patient` and `doctor` — and a consent-based,
read-only relationship between them.

Before this phase SWEETy was strictly single-user: every reading and report query was scoped to
the authenticated account, and no mechanism existed to share data. The phase keeps that ownership
model intact and adds a narrow, patient-controlled exception:

1. A doctor is an ordinary account promoted by a trusted operator through a guarded CLI. Public
   registration can never self-assign the doctor role.
2. The doctor invites a patient by email. The server creates a `pending` assignment with a
   256-bit CSPRNG token; only the token hash is stored.
3. The patient accepts the token, rejects it, or later revokes the resulting relationship.
4. Only an `active`, patient-accepted assignment grants read-only access. Every doctor request
   re-proves the relationship from PostgreSQL before touching data.
5. Revocation blocks new reads, queued report jobs, and result retrieval immediately.

Role and assignment state are never trusted from the client. `requireAuth` reloads the user from
PostgreSQL on every request, so a role change takes effect without waiting for the JWT to expire;
the JWT carries only `sub`.

### Overall readiness

- Server: 18 files / 303 tests passing, including role guards, invitation lifecycle, revocation,
  cache isolation, and BullMQ authorization re-checks.
- Client: 10 files / 98 tests passing, including role-aware redirects and route guards.
- TypeScript strict mode passes in both workspaces.
- Generated migration `0002_phase13_doctor_patient_rbac.sql` is committed; the test setup applies
  it automatically.
- No existing Phase 0–12 behaviour was removed. Self readings and reports remain patient-only;
  doctor access uses separate patient-scoped routes.

---

## B. Existing Architecture Preserved

- **Authentication:** cookie-based HS256 JWT, bcrypt cost 12, `requireAuth`.
- **Ownership:** reading and report queries remain filtered by the authenticated user id; a
  foreign record still returns `404`.
- **Reports:** PostgreSQL aggregation (`MAX`, `MIN`, `AVG`, `COUNT`) remains the source of truth.
- **Redis cache:** cache-aside with transparent fallback to PostgreSQL; caching still disabled
  when `REDIS_URL` is unset.
- **BullMQ:** a separate worker process, deterministic job ids, retries with exponential backoff,
  bounded retention, and graceful shutdown.
- **Seed safety:** `SEED_DEMO_DATA`, environment, and database-name guards are unchanged. The
  seed script was not run while developing this phase.
- **Design language:** the new pages use the existing cream/olive tokens, `Card`, `Button`,
  `Field`, `Input`, `StatusNote`, and motion conventions.

The key architectural change is that authorization now has two layers:

1. **Role** — a column on `users`, enforced per route group by `requireRole`.
2. **Relationship** — an active row in `doctor_patient_assignments`, enforced per patient route
   and re-checked inside background jobs and result retrieval.

---

## C. Data Model and Migration

Migration: `apps/server/drizzle/0002_phase13_doctor_patient_rbac.sql`.

### Enums

- `user_role`: `patient`, `doctor`
- `doctor_patient_assignment_status`: `pending`, `active`, `revoked`, `rejected`, `expired`

### `users.role`

- Non-null, defaults to `patient`.
- Existing rows are patients after the migration.
- `SafeUser` now returns `role`; no password material is exposed.

### `doctor_patient_assignments`

| Column         | Notes                                                        |
| -------------- | ------------------------------------------------------------ |
| `id`           | UUID primary key                                             |
| `doctor_id`    | FK → `users.id`, cascade delete                              |
| `patient_id`   | FK → `users.id`, cascade delete                              |
| `status`       | Assignment status enum, default `pending`                    |
| `token_hash`   | SHA-256 hash, nullable after consumption/expiry              |
| `invited_at`   | Invitation timestamp                                         |
| `expires_at`   | Invitation expiry (seven days after creation)                |
| `accepted_at`  | Set only on acceptance                                       |
| `rejected_at`  | Set only on rejection                                        |
| `revoked_at`   | Set only on revocation                                       |
| `created_at` / `updated_at` | Audit timestamps                                 |

Constraints and indexes:

- Check constraint `doctor_patient_assignments_distinct_check`: `doctor_id <> patient_id`.
- Partial unique index on `(doctor_id, patient_id)` where `status = 'pending'` — at most one
  pending invitation per pair. Stale pending rows are marked `expired` in the same transaction
  before inserting a replacement.
- Partial unique index on `(doctor_id, patient_id)` where `status = 'active'` — at most one active
  relationship per pair.
- Partial unique index on `token_hash` where it is not null — a token maps to one invitation.
- Lookup indexes on `(doctor_id, status)` and `(patient_id, status)`.

### `user_role_changes`

Audit table for the promotion CLI: `user_id`, `previous_role`, `new_role`, `changed_by`,
`changed_at`. It proves who escalated an account and when.

Historical assignment rows are retained in every terminal state. Status is always explicit; it is
never inferred from timestamps.

---

## D. API Design

### Doctor provisioning

```bash
npm run db:promote-doctor --workspace @sweety/server -- doctor@example.com --by="Ops Name"
```

`apps/server/src/scripts/promote-doctor.ts`:

- requires `<email> --by="Operator"`;
- refuses `NODE_ENV=test`, a missing `DATABASE_URL`, a database name ending in `_test` / `-test`,
  or `TEST_DATABASE_URL === DATABASE_URL`;
- updates the role and writes `user_role_changes` in one transaction;
- is idempotent and reports `already_doctor` without writing an audit row.

There is no HTTP promotion endpoint.

### Patient consent API (`/api/patient`, role `patient`)

| Method   | Endpoint                                        | Behaviour                                              |
| -------- | ----------------------------------------------- | ------------------------------------------------------ |
| `GET`    | `/doctors`                                      | Active doctors and non-expired pending invitations     |
| `POST`   | `/invitations/accept`                           | Body `{ token }`; activates the matching pending row   |
| `POST`   | `/invitations/:assignmentId/reject`             | Patient-owned pending row only                         |
| `DELETE` | `/doctors/:assignmentId`                        | Patient-owned active row only; bumps cache version     |

### Doctor API (`/api/doctor`, role `doctor`)

| Method | Endpoint                                                       | Behaviour                         |
| ------ | -------------------------------------------------------------- | --------------------------------- |
| `GET`  | `/patients`                                                    | Active patients only              |
| `GET`  | `/invitations`                                                 | Full invitation history           |
| `POST` | `/invitations`                                                 | Create a pending invitation       |
| `GET`  | `/patients/:patientId/readings`                                | Paginated patient readings        |
| `GET`  | `/patients/:patientId/readings/:readingId`                     | One patient reading               |
| `GET`  | `/patients/:patientId/reports/daily`                           | Daily report (cached)             |
| `GET`  | `/patients/:patientId/reports/month-to-date`                   | Month-to-date report (cached)     |
| `GET`  | `/patients/:patientId/reports/monthly`                         | Previous-month report (cached)    |
| `POST` | `/patients/:patientId/reports/jobs`                            | Queue a background report         |
| `GET`  | `/patients/:patientId/reports/jobs/:jobId`                     | Job status                        |
| `GET`  | `/patients/:patientId/reports/jobs/:jobId/result`              | Job result                        |

`doctorRouter.use('/patients/:patientId', requireActivePatientAssignment)` runs before every
patient-scoped handler. Invalid ids return `400`; a valid id without an active assignment returns
`404` — the same response as a nonexistent patient, preventing enumeration.

### Self-service restrictions

`/api/readings` and `/api/reports/*` now require `role = 'patient'`. A doctor cannot fall back to
self-service routes to read or mutate data; doctors have no create/update/delete path at all.

### Invitation response

`POST /api/doctor/invitations` returns the raw `inviteToken` exactly once, together with the
assignment id, patient summary, status, and expiry. The token is not stored in plaintext, is not
included in any other response, and is never logged.

---

## E. Consent and Authorization Lifecycle

### Invitation creation

1. Validate `{ email }` with Zod.
2. Look up a case-insensitive account with `role = 'patient'`.
3. Reject self-assignment.
4. Generate 32 random bytes (base64url) and hash with SHA-256.
5. Expire stale pending rows for the pair, then insert a `pending` row.
6. Return the raw token once.

A missing account and a doctor account produce the same generic `404`, so the endpoint cannot be
used to enumerate patients. A duplicate pending invitation returns `409`.

### Acceptance

The repository locks the matching row (`FOR UPDATE`) and re-validates, in one transaction:

- the token hash exists;
- status is still `pending`;
- the intended patient is the authenticated patient;
- the doctor still has the `doctor` role;
- the invitation has not expired.

On success it sets `active`, records `accepted_at`, and nulls `token_hash`, making the token
single-use. A consumed, foreign, revoked, or unknown token returns `404`; an expired one returns
`410`.

### Rejection and revocation

Both are patient-only updates that include `patient_id = authenticatedPatient` and the expected
current status. A foreign row or wrong state returns `404`. Revocation also invalidates the
patient’s report-cache version so every cached doctor view is orphaned.

### Authorization primitive

`hasActiveAssignment(doctorId, patientId)` is the single gate. It requires:

- `status = 'active'`;
- `doctor_id` and `patient_id` matching the request;
- the doctor account still has `role = 'doctor'` (joined from `users`);
- `doctor_id <> patient_id`.

It is used by the HTTP middleware, the BullMQ worker before generation, and status/result
retrieval. Revocation therefore takes effect for new requests and in-flight jobs.

---

## F. Caching, Background Jobs, and Isolation

### Report cache

- Versioned keys: `sweety:v2:reports:r{requesterId}:u{ownerId}:v{ownerVersion}:{type}:{period}`.
- The requester is part of the key, so patient, doctor, and doctor-vs-doctor views never share an
  entry even when the underlying report is identical.
- Authorization runs before the cache call; a cache hit cannot bypass a revoked or foreign
  assignment.
- The version belongs to the patient/data owner. Reading mutations and consent revocation bump
  that version, which orphans every requester’s cached view of that patient without wildcard
  deletion or key enumeration.
- Redis failures still degrade transparently to PostgreSQL.

### BullMQ payload and ids

The job payload adds `requestedBy` (the doctor) while `userId` remains the patient:

```ts
{ userId: patientId, requestedBy: doctorId, reportType, date? }
```

Job ids encode both sides:

```text
rpt_{requester}_{patient}_{reportType}_{dateOrMonthly}
```

This prevents the patient’s own job and each doctor’s job for the same patient/date from
colliding, and prevents one doctor from addressing another doctor’s job id.

The worker validates the payload, re-checks `hasActiveAssignment(requestedBy, userId)` before
generating, and the status/result handlers re-check it again. A revoked doctor gets `404` even if
the job completed while access was still active. Patient-owned jobs are unchanged.

### Retention

Finished jobs keep the Phase 12 bounded retention (`REPORT_JOB_RETENTION_SECONDS`) so generated
reports do not remain in Redis indefinitely.

---

## G. Security Properties

- **Role cannot be self-assigned.** Registration strips unknown fields and always writes
  `patient`; tests assert the returned role.
- **Fresh role checks.** `requireAuth` reloads `users.role` from PostgreSQL each request, so
  promotion or demotion is effective immediately and the JWT remains a minimal `sub` claim.
- **Route-group separation.** `requireRole('patient')` and `requireRole('doctor')` guard the
  respective APIs; handlers also require `request.authenticatedUserId`.
- **No 403 enumeration.** Foreign or revoked patients return `404`.
- **Token handling.** 256-bit CSPRNG, SHA-256 at rest, single-use, seven-day expiry, returned once,
  never logged, cleared on accept/reject/revoke/expire.
- **Transactional acceptance.** Row lock plus status/expiry/role/intended-patient checks prevent
  replay and race-based double acceptance.
- **Revocation propagates.** New reads are denied, in-flight jobs re-check before generation, and
  results are re-checked after generation.
- **Cache isolation.** Requester-scoped keys and owner-version invalidation prevent cross-role
  leakage.
- **Operator-only provisioning.** The CLI is audited, guarded against test databases, and not
  reachable over HTTP.
- **Rate limiting.** Doctor invitation creation uses the existing in-memory limiter pattern.

---

## H. Frontend

- `SafeUser.role` and `roleHomePath` centralize role routing: patient → `/today`,
  doctor → `/patients`.
- `RequireRole` gates route branches; a user who follows the other role’s URL is redirected to
  their own home instead of seeing a dead end.
- `GuestRoute` and login/register redirects are role-aware. `login` / `register` return the
  `SafeUser` so the destination can be chosen immediately.
- `AppLayout` shows patient navigation (`Today`, `Readings`, `Reports`, `Care team`) or doctor
  navigation (`Patients`).
- `CareTeamPage`: accept an invitation token, reject a pending invitation, and revoke an active
  doctor.
- `DoctorPatientsPage`: active patients, invitation history, and the one-time token display with
  an explicit out-of-band-delivery warning.
- `DoctorPatientPage`: read-only readings with pagination/date filter, plus daily,
  month-to-date, and previous-month report tabs. It reuses the exported `DailyReportView` and
  `PeriodReportView` from `ReportsPage`, so charts and summaries stay consistent.
- Doctor views never render add/edit/delete controls.

---

## I. Testing Results

### Server

18 test files / 303 tests. Added or extended coverage for:

- registration never assigning `doctor`;
- `requireRole` and fresh role reloads;
- guarded promotion, including audit rows and test-database refusals;
- invitation creation, hashing, expiry, single-use acceptance, wrong-patient tokens, rejection,
  revocation;
- active vs revoked vs foreign patient access (`404`), self-assignment, and doctor demotion;
- reading/report access through doctor routes and patient-only self routes;
- cache keys separating requester views and invalidation on revocation;
- BullMQ payloads recording requester and patient, scoped ids, worker re-checks, and revoked
  result retrieval;
- existing Phase 0–12 suites continue to pass.

### Client

10 test files / 98 tests. Added or extended coverage for:

- role-aware landing/login redirects;
- doctor redirected from a patient route to `/patients`;
- patient redirected from a doctor route to `/today`;
- patient and doctor navigation labels;
- existing readings, reports, chart, form, and HTTP tests.

### Quality gates

```bash
npm run typecheck
npm test
```

Both workspaces pass. The test database still requires `TEST_DATABASE_URL` ending `_test`; its
global setup applies the Phase 13 migration.

---

## J. Files Changed

### Server — new

- `apps/server/drizzle/0002_phase13_doctor_patient_rbac.sql`
- `apps/server/drizzle/meta/0002_snapshot.json`
- `apps/server/src/modules/access/access.controller.ts`
- `apps/server/src/modules/access/access.middleware.ts`
- `apps/server/src/modules/access/access.repository.ts`
- `apps/server/src/modules/access/access.routes.ts`
- `apps/server/src/modules/access/access.routes.test.ts`
- `apps/server/src/modules/access/access.service.ts`
- `apps/server/src/modules/access/access.validation.ts`
- `apps/server/src/modules/access/invitationToken.ts`
- `apps/server/src/modules/doctor/doctor.controller.ts`
- `apps/server/src/modules/doctor/doctor.routes.ts`
- `apps/server/src/scripts/promote-doctor.ts`

### Server — modified

- `apps/server/src/app.ts` — mount `/api/patient` and `/api/doctor`
- `apps/server/src/database/schema.ts` — roles, assignments, audit table
- `apps/server/src/database/seed.ts` — demo doctor and consent-safe assignment
- `apps/server/src/middleware/auth.ts` — DB-backed auth, role guard, authenticated user
- `apps/server/src/middleware/rate-limit.ts` — invitation limiter
- `apps/server/src/modules/auth/*` — `role` in safe user, types, service, tests
- `apps/server/src/modules/readings/readings.routes.ts` — patient-only
- `apps/server/src/modules/reports/reports.routes.ts` — patient-only
- `apps/server/src/modules/reports/reports.cache.ts` — requester-aware wrappers
- `apps/server/src/cache/reportCache.ts` — v2 cache keys
- `apps/server/src/jobs/reportQueue.ts` — requester payload, scoped ids, result re-checks
- `apps/server/src/jobs/reportProcessor.ts` — worker consent re-check
- `apps/server/package.json` — `db:promote-doctor`
- `apps/server/drizzle/meta/_journal.json`

### Client — new

- `apps/client/src/pages/CareTeamPage.tsx`
- `apps/client/src/pages/DoctorPatientsPage.tsx`
- `apps/client/src/pages/DoctorPatientPage.tsx`
- `apps/client/src/services/accessApi.ts`
- `apps/client/src/services/doctorApi.ts`

### Client — modified

- `apps/client/src/App.tsx` — role route branches
- `apps/client/src/App.test.tsx` — role redirects and guards
- `apps/client/src/context/AuthContext.tsx` — `RequireRole`, role-aware `GuestRoute`
- `apps/client/src/context/auth.ts` — return `SafeUser` from login/register
- `apps/client/src/components/layout/AppLayout.tsx` — role navigation
- `apps/client/src/pages/LoginPage.tsx` / `RegisterPage.tsx` — role-aware redirects
- `apps/client/src/pages/ReportsPage.tsx` — export report views
- `apps/client/src/types/user.ts` — `UserRole`, `roleHomePath`

### Documentation

- `README.md` — roles, promotion, consent lifecycle, API, isolation, limitations
- `.agents/tasks/phase13-doctor-patient-assignment.md`

---

## K. Remaining Limitations

- **No email delivery.** The raw token is returned to the doctor once and must be shared out of
  band. A production deployment should add a verified email channel and stop returning the token
  in the API response.
- **No doctor messaging, scheduling, or notifications.** Access is read-only data sharing.
- **No export or print workflow** for doctors.
- **Demotion is CLI/database-only.** There is no operator UI, and demoting a doctor leaves
  assignment rows intact; the join on `users.role` immediately removes access.
- **No per-assignment access log.** The system records consent state changes, not which patient
  records a doctor viewed.
- **Invitation rate limiting is in-memory**, like the existing auth limiter; it resets on restart
  and is not shared across instances.
- **Pending invitations are not pushed.** The patient only sees them by opening Care team or by
  receiving the token out of band.
- **No bulk patient management.** Doctors invite one patient at a time.
