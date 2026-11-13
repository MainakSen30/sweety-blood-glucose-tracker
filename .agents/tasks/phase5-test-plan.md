# Phase 5 – Test Plan: Testing and Hardening

## 1. Infrastructure Summary

| Item | Detail |
|---|---|
| Test runner | Vitest (`vitest run` / `vitest`) |
| HTTP layer | Supertest against the Express `app` exported from `src/app.ts` |
| Test DB | PostgreSQL, `TEST_DATABASE_URL` → `sweety_test` (ends in `_test` ✓) |
| Global setup | `tests/global-setup.ts` — runs Drizzle migrations before any test |
| Reset helpers | `resetUsersTable()`, `resetReadingsTable()`, `resetDatabase()` in `tests/database.ts` |
| Pool helper | `getTestPool()` for direct SQL assertions; `closeTestPool()` in `afterAll` |
| `fileParallelism` | `false` — all suites run sequentially to share one DB without racing |
| Env injection | `vitest.config.ts` sets `NODE_ENV=test`, `DATABASE_URL=TEST_DATABASE_URL`, JWT vars |
| Rate limiter | Skipped when `NODE_ENV=test` — integration tests are deterministic |
| Run command | `npm run test --workspace @sweety/server` or `cd apps/server && npx vitest run` |

---

## 2. Existing Test Files

| File | Description |
|---|---|
| `src/app.test.ts` | Health endpoint smoke test |
| `src/middleware/rate-limit.test.ts` | `createAuthRateLimiter` unit tests |
| `src/modules/auth/auth.routes.test.ts` | Auth integration tests (register, login, me, logout) |
| `src/modules/readings/readings.routes.test.ts` | Readings CRUD integration tests + DB constraint tests |
| `src/modules/reports/reports.routes.test.ts` | Report integration tests + pure date-range unit tests |

---

## 3. Coverage Checklist

Legend: **EXISTING** = already tested (file → test name) · **MISSING** = not yet covered

---

### A. Validation

#### A1. Glucose value validation

| # | Scenario | Status |
|---|---|---|
| A1-1 | Value at minimum boundary (40) accepted | **MISSING** |
| A1-2 | Value at maximum boundary (600) accepted | **MISSING** |
| A1-3 | Value below minimum (39) rejected with correct message | **EXISTING** — `readings.routes.test.ts` → "rejects a value below 40" |
| A1-4 | Value above maximum (601) rejected with correct message | **EXISTING** — `readings.routes.test.ts` → "rejects a value above 600" |
| A1-5 | Zero rejected | **MISSING** |
| A1-6 | Negative value rejected | **MISSING** |
| A1-7 | Decimal value rejected (integer-only schema) | **EXISTING** — `readings.routes.test.ts` → "rejects a decimal value" |
| A1-8 | String value rejected ("abc") | **MISSING** |
| A1-9 | null value rejected | **MISSING** |
| A1-10 | Missing value field rejected with correct message | **EXISTING** — `readings.routes.test.ts` → "rejects a missing glucose value with the exact message" |

#### A2. Date validation (create/update readings)

| # | Scenario | Status |
|---|---|---|
| A2-1 | Valid historical date accepted | **EXISTING** — `readings.routes.test.ts` → "creates a reading and keeps readingDate as a date-only string" |
| A2-2 | Today accepted | **MISSING** |
| A2-3 | Future date rejected with correct message | **EXISTING** — `readings.routes.test.ts` → "rejects a date in the future with the exact message" |
| A2-4 | Invalid format (YYYY-MM-DD instead of DD-MM-YYYY) rejected | **EXISTING** — `readings.routes.test.ts` → "rejects an impossible calendar date" (uses ISO format) |
| A2-5 | Impossible calendar date (e.g. 31-02-2026) rejected | **EXISTING** — `readings.routes.test.ts` → "rejects an impossible calendar date" |
| A2-6 | Completely non-date string rejected | **MISSING** |
| A2-7 | Missing readingDate field rejected | **MISSING** |

#### A3. Reading slot validation

| # | Scenario | Status |
|---|---|---|
| A3-1 | All four valid slots accepted (morning, after_breakfast, after_lunch, after_dinner) | **EXISTING** — `readings.routes.test.ts` → "allows four readings in one day" (all four slots) |
| A3-2 | Invalid slot ("noon") rejected with correct message | **EXISTING** — `readings.routes.test.ts` → "rejects an unsupported slot" |
| A3-3 | Missing slot field rejected | **MISSING** |
| A3-4 | Duplicate slot same user+date rejected (conflict 409) | **EXISTING** — `readings.routes.test.ts` → "rejects a duplicate slot on the same date with a friendly conflict message" |
| A3-5 | Conflict message uses "an" article for after_breakfast | **EXISTING** — `readings.routes.test.ts` → "uses the "an" article for slots whose label starts with a vowel" |
| A3-6 | Same slot different dates allowed | **EXISTING** — `readings.routes.test.ts` → "allows the same slot on a different date" |
| A3-7 | Same slot + date for two different users allowed | **EXISTING** — `readings.routes.test.ts` → "allows the same date and slot for two different users" |

#### A4. Daily reading limit

| # | Scenario | Status |
|---|---|---|
| A4-1 | First–fourth reading all accepted | **EXISTING** — `readings.routes.test.ts` → "allows four readings in one day" |
| A4-2 | Fifth reading rejected with correct 409 message | **EXISTING** — `readings.routes.test.ts` → "rejects a fifth reading on the same day with the exact daily-limit message" |
| A4-3 | Limit applies per-day — next day unaffected | **EXISTING** — `readings.routes.test.ts` → "rejects a fifth reading on the same day…" (nextDay assertion) |
| A4-4 | Deleting a reading and then adding another stays within limit | **MISSING** |
| A4-5 | Updating an existing reading does not incorrectly count as an extra reading | **MISSING** — the update service uses `excludeId` when the date changes but there is no integration test verifying count stays correct after updating on the same date |

#### A5. Payload / body validation

| # | Scenario | Status |
|---|---|---|
| A5-1 | Missing required fields (empty body `{}`) on create | **MISSING** — no test sends a completely empty body to POST /api/readings |
| A5-2 | Unexpected extra properties ignored (Zod strips by default) | **MISSING** |
| A5-3 | Malformed JSON body — Express returns 400 | **MISSING** |
| A5-4 | Null body / `Content-Type` absent | **MISSING** |
| A5-5 | Empty PATCH body rejected (no fields to update) | **EXISTING** — `readings.routes.test.ts` → "rejects an empty update body" |
| A5-6 | Missing name on registration | **MISSING** |
| A5-7 | Missing email on registration | **MISSING** |
| A5-8 | Malformed JSON on registration | **MISSING** |
| A5-9 | Malformed JSON on login | **MISSING** |
| A5-10 | Missing credentials on login | **MISSING** |

---

### B. Authentication

#### B1. Registration

| # | Scenario | Status |
|---|---|---|
| B1-1 | Successful registration returns 201, safe user body, HttpOnly cookie | **EXISTING** — `auth.routes.test.ts` → "creates a user, hashes the password, and returns a safe user with a cookie" |
| B1-2 | Password is hashed (bcrypt compare) | **EXISTING** — `auth.routes.test.ts` → same test, DB query |
| B1-3 | passwordHash not exposed in response | **EXISTING** — `auth.routes.test.ts` → same test, `not.toHaveProperty('passwordHash')` |
| B1-4 | Cookie has HttpOnly and SameSite=Lax | **EXISTING** — `auth.routes.test.ts` → same test |
| B1-5 | Duplicate email (case-insensitive) rejected 409 | **EXISTING** — `auth.routes.test.ts` → "rejects a duplicate email case-insensitively" |
| B1-6 | Invalid email format rejected 400 | **EXISTING** — `auth.routes.test.ts` → "rejects an invalid email" |
| B1-7 | Password shorter than 8 characters rejected 400 | **EXISTING** — `auth.routes.test.ts` → "rejects passwords shorter than 8 characters" |
| B1-8 | Missing name rejected | **MISSING** |
| B1-9 | Missing email rejected | **MISSING** |
| B1-10 | Name too long (>120 chars) rejected | **MISSING** |
| B1-11 | Email too long (>255 chars) rejected | **MISSING** |
| B1-12 | Incorrect data types (number instead of string) | **MISSING** |
| B1-13 | Malformed JSON body | **MISSING** |

#### B2. Login

| # | Scenario | Status |
|---|---|---|
| B2-1 | Successful login returns 200, safe user, sets cookie | **EXISTING** — `auth.routes.test.ts` → "logs in with a valid email and password" |
| B2-2 | Incorrect password rejected 401 without revealing account existence | **EXISTING** — `auth.routes.test.ts` → "rejects an incorrect password without revealing account existence" |
| B2-3 | Non-existent email rejected with same message | **EXISTING** — `auth.routes.test.ts` → "rejects a non-existent email with the same message as an incorrect password" |
| B2-4 | Missing credentials (empty body) rejected | **MISSING** |
| B2-5 | Malformed JSON body rejected | **MISSING** |
| B2-6 | Login is case-insensitive for email | **MISSING** (the schema lowercases, but no integration test verifies login with mixed-case email after registering lowercase) |

#### B3. Session / protected access / logout

| # | Scenario | Status |
|---|---|---|
| B3-1 | GET /api/auth/me returns authenticated user | **EXISTING** — `auth.routes.test.ts` → "returns the authenticated user" |
| B3-2 | GET /api/auth/me without cookie → 401 | **EXISTING** — `auth.routes.test.ts` → "rejects a request without an authentication cookie" |
| B3-3 | GET /api/auth/me with invalid JWT → 401 | **EXISTING** — `auth.routes.test.ts` → "rejects an invalid JWT" |
| B3-4 | GET /api/auth/me with expired JWT → 401 | **EXISTING** — `auth.routes.test.ts` → "rejects an expired JWT" |
| B3-5 | Logout clears cookie (Expires=1970, HttpOnly, SameSite) | **EXISTING** — `auth.routes.test.ts` → "clears the authentication cookie" |
| B3-6 | Logout without cookie still returns 200 | **EXISTING** — `auth.routes.test.ts` → "succeeds without an authentication cookie" |
| B3-7 | Access to protected reading route after logout → 401 | **MISSING** — no test registers, logs out, then tries a reading endpoint |
| B3-8 | JWT sub is a UUID (non-UUID sub token rejected) | **MISSING** — `verifyAuthToken` validates UUID sub; no integration test covers a valid JWT with non-UUID sub |

---

### C. Authorization

| # | Scenario | Status |
|---|---|---|
| C1 | User A can read their own reading | **EXISTING** — `readings.routes.test.ts` → "returns the reading to its owner" |
| C2 | User B cannot read User A's reading → 404 | **EXISTING** — `readings.routes.test.ts` → "returns 404 for another user's reading without revealing it" |
| C3 | User B cannot update User A's reading → 404 | **EXISTING** — `readings.routes.test.ts` → "returns 404 when another user tries to update the reading" |
| C4 | User B cannot delete User A's reading → 404 and data preserved | **EXISTING** — `readings.routes.test.ts` → "returns 404 when another user tries to delete the reading and keeps the data" |
| C5 | GET /api/readings only returns the caller's readings | **EXISTING** — `readings.routes.test.ts` → "returns only the authenticated user's readings" |
| C6 | User B's report does not include User A's readings (daily) | **EXISTING** — `reports.routes.test.ts` → "excludes another user's readings on the same date" |
| C7 | User B's report does not include User A's readings (month-to-date) | **EXISTING** — `reports.routes.test.ts` → "excludes another user's readings in the same period" |
| C8 | User B's report does not include User A's readings (monthly) | **EXISTING** — `reports.routes.test.ts` → "excludes another user's readings in the previous month" |
| C9 | Unauthenticated access to all reading endpoints → 401 | **EXISTING** — `readings.routes.test.ts` → "rejects unauthenticated creation, listing, retrieval, update, and deletion" |
| C10 | Unauthenticated access to all report endpoints → 401 | **EXISTING** — `reports.routes.test.ts` → "rejects requests without an authentication cookie" |
| C11 | User with no readings at all — reports return empty summaries | **EXISTING** — `reports.routes.test.ts` → "returns a successful empty report when the previous month has no readings" etc. |

---

### D. Report Calculations

#### D1. Daily report

| # | Scenario | Status |
|---|---|---|
| D1-1 | All four slots present — correct highest, lowest, average, totalReadings | **EXISTING** — `reports.routes.test.ts` → "returns the known aggregates and readings in slot order" |
| D1-2 | Readings returned in slot order (morning → after_dinner) | **EXISTING** — `reports.routes.test.ts` → same test (reverse-seeded, ordered response verified) |
| D1-3 | Average rounded to one decimal (100.666… → 100.7) | **EXISTING** — `reports.routes.test.ts` → "rounds the average to one decimal place in both directions" |
| D1-4 | Average rounded up (100.5) | **EXISTING** — `reports.routes.test.ts` → same test |
| D1-5 | Empty day → all summary fields null, readings [], 200 | **EXISTING** — `reports.routes.test.ts` → "returns a successful empty report (not 404) when the date has no readings" |
| D1-6 | Single reading → average = that reading's value, highest = lowest | **MISSING** |
| D1-7 | Cross-user isolation | **EXISTING** — `reports.routes.test.ts` → "excludes another user's readings on the same date" |
| D1-8 | Date validation — missing date | **EXISTING** — `reports.routes.test.ts` → "rejects a missing date" |
| D1-9 | Date validation — wrong format (YYYY-MM-DD) | **EXISTING** — `reports.routes.test.ts` → "rejects a date in the wrong format" |
| D1-10 | Date validation — impossible calendar date | **EXISTING** — `reports.routes.test.ts` → "rejects an impossible calendar date" |
| D1-11 | Date validation — future date | **EXISTING** — `reports.routes.test.ts` → "rejects a future date" |
| D1-12 | Today's date accepted | **MISSING** — no test verifies today works for the daily report |
| D1-13 | First day of a month | **MISSING** |
| D1-14 | Last day of a month | **MISSING** |

#### D2. Month-to-date report

| # | Scenario | Status |
|---|---|---|
| D2-1 | Period starts on 1st of reference month, ends on reference date (inclusive) | **EXISTING** — `reports.routes.test.ts` → "reports the period from the first of the month…" |
| D2-2 | First-day boundary reading included | **EXISTING** — same test (`01-01-2026`) |
| D2-3 | End-date boundary reading included | **EXISTING** — same test (`15-01-2026`) |
| D2-4 | Reading after end date excluded | **EXISTING** — same test (`16-01-2026`) |
| D2-5 | Reading in prior month excluded | **EXISTING** — same test (`15-12-2025`) |
| D2-6 | Average is over individual readings, not daily averages | **EXISTING** — `reports.routes.test.ts` → "averages the individual readings, not the daily averages" |
| D2-7 | Empty period returns null summary and 200 | **EXISTING** — `reports.routes.test.ts` → "returns a successful empty report when the period has no readings" |
| D2-8 | Cross-user isolation | **EXISTING** — `reports.routes.test.ts` → "excludes another user's readings in the same period" |
| D2-9 | Date validation (missing/malformed/impossible/future) | **EXISTING** — `reports.routes.test.ts` → "rejects a missing, malformed, impossible, or future date" |
| D2-10 | Single reading in period | **MISSING** |
| D2-11 | Reference date is first of the month (period of one day) | **MISSING** |

#### D3. Date-range pure helpers (unit tests in reports.routes.test.ts)

| # | Scenario | Status |
|---|---|---|
| D3-1 | `monthToDateRange` — start = 1st of month, end = reference date | **EXISTING** — `reports.routes.test.ts` → "month-to-date starts on the first…" |
| D3-2 | `previousMonthRange` — January → December of previous year | **EXISTING** — `reports.routes.test.ts` → "previous month of January is December of the previous year" |
| D3-3 | `previousMonthRange` — leap-year March → 29-day February | **EXISTING** — `reports.routes.test.ts` → "previous month of a leap-year March has a 29-day February" |
| D3-4 | `previousMonthRange` — non-leap-year March → 28-day February | **EXISTING** — `reports.routes.test.ts` → "previous month of a non-leap-year March has a 28-day February" |
| D3-5 | `previousMonthRange` — December → November of same year | **MISSING** |
| D3-6 | `monthToDateRange` — reference date is last day of month | **MISSING** |

#### D4. Previous-month report

| # | Scenario | Status |
|---|---|---|
| D4-1 | Whole previous calendar month included, current-month reading excluded | **EXISTING** — `reports.routes.test.ts` → "reports the whole previous calendar month and excludes current-month readings" |
| D4-2 | Empty previous month → null summary, 200 | **EXISTING** — `reports.routes.test.ts` → "returns a successful empty report when the previous month has no readings" |
| D4-3 | Cross-user isolation | **EXISTING** — `reports.routes.test.ts` → "excludes another user's readings in the previous month" |
| D4-4 | Period dates in response use DD-MM-YYYY format | **EXISTING** — `reports.routes.test.ts` → regex `\d{2}-\d{2}-\d{4}` assertion |
| D4-5 | Single reading in previous month | **MISSING** |
| D4-6 | December → verify it covers all 31 days of December | **MISSING** |

---

### E. Error Handling and Edge Cases

| # | Scenario | Status |
|---|---|---|
| E1 | GET /api/readings/:id with nonexistent UUID → 404 | **EXISTING** — `readings.routes.test.ts` → "returns 404 for a nonexistent reading" |
| E2 | GET/PATCH/DELETE with malformed (non-UUID) ID → 400 | **MISSING** — no test sends `GET /api/readings/not-a-uuid`; the `readingIdParamSchema` rejects it but no test covers this path |
| E3 | PATCH /api/readings/:id with invalid value (700) → 400 | **EXISTING** — `readings.routes.test.ts` → "rejects an invalid value on update" |
| E4 | PATCH /api/readings/:id with future date → 400 | **EXISTING** — `readings.routes.test.ts` → "rejects a future date on update" |
| E5 | PATCH /api/readings/:id with conflicting slot → 409 | **EXISTING** — `readings.routes.test.ts` → "rejects an update that conflicts with an existing slot on the same date" |
| E6 | DB check-constraint bypass attempt (direct insert with value 999) → pg code 23514 | **EXISTING** — `readings.routes.test.ts` → "enforces the value check constraint in the database" |
| E7 | CASCADE delete — readings deleted when user is deleted | **EXISTING** — `readings.routes.test.ts` → "cascades reading deletion when the user is deleted" |
| E8 | Unsupported HTTP method on existing route → 404 "Route not found" | **MISSING** — no test sends e.g. PUT /api/readings |
| E9 | Unknown route → 404 "Route not found" | **MISSING** — the 404 handler in `app.ts` is never exercised by a test |
| E10 | Error response never leaks stack trace or DB details | **MISSING** — no test triggers an internal 500 to verify the sanitized error body |
| E11 | GET /api/readings with invalid filter date → 400 | **EXISTING** — `readings.routes.test.ts` → "rejects an invalid filter date" |
| E12 | GET /api/readings with future filter date → 400 | **EXISTING** — `readings.routes.test.ts` → "rejects a future filter date" |
| E13 | GET /api/readings — combining `date` with `from` → 400 | **EXISTING** — `readings.routes.test.ts` → "rejects combining date with from" |
| E14 | GET /api/readings — combining `date` with `to` → 400 | **EXISTING** — `readings.routes.test.ts` → "rejects combining date with to" |
| E15 | GET /api/readings — `from` later than `to` → 400 | **EXISTING** — `readings.routes.test.ts` → "rejects a from date later than the to date" |
| E16 | Malformed JSON body → 400 from Express JSON parser | **MISSING** — applies to all POST/PATCH endpoints; never tested |
| E17 | GET /api/readings — `from` without `to` allowed (open-ended range) | **MISSING** — no test verifies a one-sided range works |

---

## 4. Count Summary

| Section | Existing | Missing | Total |
|---|---|---|---|
| A. Validation | 15 | 18 | 33 |
| B. Authentication | 13 | 8 | 21 |
| C. Authorization | 11 | 0 | 11 |
| D. Report calculations | 22 | 8 | 30 |
| E. Error handling | 10 | 7 | 17 |
| **Total** | **71** | **41** | **112** |

---

## 5. Critical Blockers

**None.** The test infrastructure is healthy:

- `TEST_DATABASE_URL` is set in `.env` and the database name is `sweety_test` (ends with `_test` ✓).
- `requireTestDatabaseUrl()` in `tests/database.ts` enforces this check at runtime and throws before any destructive operation if the name does not end with `_test`.
- `DATABASE_URL` is overwritten by `vitest.config.ts` to equal `TEST_DATABASE_URL`, so the application's DB connection always points to the test database when tests run.
- Drizzle migrations run automatically in `global-setup.ts` before any test file executes.
- `fileParallelism: false` prevents cross-suite data races.

---

## 6. Notes on Missing Coverage (prioritised)

### High priority
- **A1-1, A1-2** (boundary values 40 and 600 accepted) — boundary conditions are the most common off-by-one defects.
- **A5-3, B1-13, B2-5, E16** (malformed JSON) — Express returns its own 400 format for unparseable bodies; this may not match the application's `{ status, message, details }` shape and deserves a test.
- **E2** (non-UUID reading ID) — the `readingIdParamSchema` path that returns 400 is exercised by no test.
- **B3-7** (access after logout) — verifies the full auth cycle end-to-end.

### Medium priority
- **A4-4** (delete then add — daily limit resets) and **A4-5** (update does not inflate count) — important for correctness of the `countReadingsForDate` + `excludeId` logic.
- **D1-6, D2-10, D4-5** (single-reading reports) — edge case where avg = min = max.
- **D3-5, D3-6** (remaining `previousMonthRange` and `monthToDateRange` edge cases).
- **E8, E9** (unsupported method and unknown route) — the 404 handler is untested.

### Low priority
- **A1-8, A1-9** (string/null glucose value) — Zod already rejects these; a test adds regression coverage.
- **A5-2** (extra properties stripped) — Zod strips unknown keys by default; a test confirms the behaviour.
- **B2-6** (login case-insensitivity) — schema lowercases, but no integration test exercises mixed-case login.
- **E17** (open-ended `from`-only range) — not forbidden by the schema, expected to work.

### Ambiguous behaviour (document, do not change)
- **`roundToOneDecimal` in reports.service.ts** uses `Math.round(x * 10) / 10`. JavaScript floating-point: `Math.round(1.005 * 10) / 10` can yield `1` instead of `1.1`. This is not a bug introduced by this phase, and the existing tests cover the documented rounding — do not silently alter it. If a test ever triggers this, document the finding.
- **Update with same date + same slot on own reading** — the `updateReading` path does not call `countReadingsForDate` when the date does not change, so updating `value` while keeping `slot` and `readingDate` identical never re-counts. This is correct but worth an explicit test.
