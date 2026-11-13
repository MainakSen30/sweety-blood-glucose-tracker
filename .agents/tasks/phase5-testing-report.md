# Phase 5 – Testing and Hardening: Final Report

## 1. Existing test coverage discovered

Five test files were already in place before this phase:

| File | Tests | Description |
|---|---|---|
| `src/app.test.ts` | 1 | Health endpoint smoke test |
| `src/middleware/rate-limit.test.ts` | 2 | `createAuthRateLimiter` unit tests |
| `src/modules/auth/auth.routes.test.ts` | 13 | Registration, login, me, logout integration tests |
| `src/modules/readings/readings.routes.test.ts` | 38 | Full CRUD, validation, auth, authorization, DB constraints |
| `src/modules/reports/reports.routes.test.ts` | 22 | Daily/MTD/monthly report integration + pure date-range helpers |

**Pre-existing total: 76 tests**  
(The plan counted 71; the difference is 5 tests in `readings.routes.test.ts` that cover
list-filter scenarios not fully mapped in the plan checklist.)

---

## 2. New tests added

| File | Tests | Plan IDs covered |
|---|---|---|
| `apps/server/src/modules/readings/readings.validation.test.ts` | 16 | A1-1,2,5,6,8,9; A2-2,6,7; A3-3; A4-4,5; A5-1,2,3,4 |
| `apps/server/src/modules/auth/auth.supplemental.test.ts` | 23 | B1-8..13; B2-4..6; B3-7,8; cookie attrs; A5-6,7,8,9,10; E2; C (cross-user report isolation) |
| `apps/server/src/modules/reports/reports.supplemental.test.ts` | 17 | D1-6,12,13,14; D2-10,11; D3-5,5b,6,6b; D4-5,6; rounding documentation |
| `apps/server/src/error-handling.test.ts` | 16 | E8,E9,E10,E16,E17; duplicate record shape; invalid query params |

**New tests total: 72**

---

## 3. Total test count

| Metric | Count |
|---|---|
| Pre-existing tests | 76 |
| New tests added | 72 |
| **Grand total** | **148** |
| Test files total | 9 |

---

## 4. Test pass/fail summary (actual results)

```
Test Files  9 passed (9)
     Tests  148 passed (148)
  Start at  16:52:33
  Duration  30.92s
```

**All 148 tests pass. Zero failures.**

---

## 5. Authentication and authorization coverage

### Registration
- ✅ Successful registration (201, hashed password, HttpOnly cookie, safe body)
- ✅ Duplicate email (case-insensitive) → 409
- ✅ Invalid email → 400
- ✅ Short password → 400
- ✅ Missing name → 400 (new)
- ✅ Missing email → 400 (new)
- ✅ Name > 120 chars → 400 (new)
- ✅ Email > 255 chars → 400 (new)
- ✅ Wrong type (number for name) → 400 (new)
- ✅ Malformed JSON body → 400 (new, also exercises bug fix)

### Login
- ✅ Successful login (200, safe body, HttpOnly cookie)
- ✅ Wrong password → 401 (same message as nonexistent email)
- ✅ Nonexistent email → 401
- ✅ Empty body / missing credentials → 400 (new)
- ✅ Malformed JSON body → 400 (new)
- ✅ Mixed-case email login → 200 (new)

### Session / logout
- ✅ Authenticated GET /api/auth/me → 200
- ✅ No cookie → 401
- ✅ Invalid JWT → 401
- ✅ Expired JWT → 401
- ✅ Logout clears cookie (Expires=1970, HttpOnly, SameSite=Lax, no Max-Age)
- ✅ Logout without cookie → 200
- ✅ Post-logout cookie shape verified (new)
- ✅ JWT with non-UUID sub → 401 (new)

### Cookie attributes
- ✅ HttpOnly and SameSite=Lax on registration and login cookies (new explicit test)
- ✅ Token NOT in JSON response body / not in `token`/`accessToken` fields (new)

### Authorization
- ✅ User A can read own reading
- ✅ User B GET/PATCH/DELETE User A's reading → 404 each
- ✅ GET /api/readings returns only caller's readings
- ✅ Unauthenticated access to all reading endpoints → 401
- ✅ Unauthenticated access to all report endpoints → 401 (new explicit tests)
- ✅ User B's daily/MTD/monthly report never includes User A's readings (new comprehensive test)
- ✅ Non-UUID reading ID on GET/PATCH/DELETE → 400 (new)

---

## 6. Validation coverage

### Glucose values
- ✅ 40 accepted (new boundary test)
- ✅ 600 accepted (new boundary test)
- ✅ 39 rejected
- ✅ 601 rejected
- ✅ 0 rejected (new)
- ✅ Negative (-10) rejected (new)
- ✅ Decimal rejected (existing)
- ✅ String ("abc") rejected (new)
- ✅ null rejected (new)
- ✅ Missing field rejected

### Dates
- ✅ Valid historical date accepted
- ✅ Today accepted (new)
- ✅ Future date rejected
- ✅ Impossible calendar date (e.g. 31-02-2026) rejected
- ✅ Wrong format (ISO YYYY-MM-DD) rejected
- ✅ Non-date string rejected (new)
- ✅ Missing field rejected (new)

### Slots
- ✅ All four valid slots accepted
- ✅ Invalid slot ("noon") rejected
- ✅ Missing slot field rejected (new)
- ✅ Duplicate user+date+slot → 409
- ✅ Duplicate with vowel-starting slot uses "an" article
- ✅ Same slot on different dates → allowed
- ✅ Same slot+date for two users → allowed

### Daily limit
- ✅ First–fourth reading all accepted
- ✅ Fifth reading → 409
- ✅ Limit is per-day (next day unaffected)
- ✅ Delete then add stays within limit (new)
- ✅ Update does not recount (new)

### Payload validation
- ✅ Empty body {} on create → 400 with all three missing fields (new)
- ✅ Extra properties stripped (Zod default strips) (new)
- ✅ Malformed JSON → 400 on POST /api/readings (new)
- ✅ Malformed JSON → 400 on PATCH /api/readings/:id (new)
- ✅ Malformed JSON → 400 on POST /api/auth/register (new)
- ✅ Malformed JSON → 400 on POST /api/auth/login (new)
- ✅ text/plain Content-Type with no JSON body → 400 (new)
- ✅ Empty PATCH body → 400 "Provide at least one field to update"

---

## 7. Report calculation coverage

### Daily report
- ✅ All four slots present — correct highest/lowest/average/totalReadings
- ✅ Readings returned in slot order (morning → after_dinner)
- ✅ Average rounded down (100.666… → 100.7)
- ✅ Average rounded up (100.5)
- ✅ Empty day → all summary nulls, readings [], 200
- ✅ Single reading → avg = min = max (new)
- ✅ Today's date accepted (new)
- ✅ First day of month (new)
- ✅ Last day of month (new)
- ✅ Cross-user isolation
- ✅ Date validation: missing / wrong format / impossible / future

### Month-to-date report
- ✅ Period from 1st of month to reference date, boundaries inclusive
- ✅ Averages individual readings, not daily averages
- ✅ Empty period → null summary, 200
- ✅ Cross-user isolation
- ✅ Date validation (missing/malformed/impossible/future)
- ✅ Single reading in period → avg = min = max (new)
- ✅ Reference date = 1st of month → one-day period (new)

### Previous-month report
- ✅ Whole previous calendar month included, current-month excluded
- ✅ Empty previous month → null summary, 200
- ✅ Cross-user isolation
- ✅ Period dates in DD-MM-YYYY format
- ✅ Single reading (new)
- ✅ December covers 31 days (new)

### Date-range pure helpers
- ✅ `monthToDateRange` — start = 1st of month, end = reference date
- ✅ `previousMonthRange` — January → December of previous year
- ✅ `previousMonthRange` — leap-year March → 29-day February
- ✅ `previousMonthRange` — non-leap-year March → 28-day February
- ✅ `previousMonthRange` — December → November (new)
- ✅ `previousMonthRange` — January → December (covered from two angles, new)
- ✅ `monthToDateRange` — reference = last day of month (new)
- ✅ `monthToDateRange` — reference = first day gives one-day period (new)

---

## 8. Error handling coverage

- ✅ GET /api/readings/:id nonexistent UUID → 404
- ✅ GET/PATCH/DELETE non-UUID reading ID → 400 (new)
- ✅ PATCH with invalid value (700) → 400
- ✅ PATCH with future date → 400
- ✅ PATCH conflicting slot → 409
- ✅ DB check-constraint bypass (direct INSERT value 999) → pg code 23514
- ✅ CASCADE delete when user deleted
- ✅ Unsupported HTTP method (PUT /api/readings) → 404 "Route not found" (new)
- ✅ Completely unknown route → 404 "Route not found" (new)
- ✅ Unknown sub-path under known prefix → 404 (new)
- ✅ Malformed JSON → 400 on all POST/PATCH endpoints (new)
- ✅ Error responses do not leak stack traces (new)
- ✅ Error responses do not leak DB details (new)
- ✅ 400 validation errors contain only status/message/details (new)
- ✅ 409 conflict errors contain only status/message (new)
- ✅ Open-ended `from`-only range → allowed (new)
- ✅ Open-ended `to`-only range → allowed (new)
- ✅ Invalid date query on report endpoints → 400 (new)
- ✅ Duplicate record → 409 friendly message (new)
- ✅ Failed duplicate does not leave partial data (new)
- ✅ GET /api/readings invalid filter date → 400
- ✅ Combining `date` with `from` or `to` → 400
- ✅ `from` later than `to` → 400

---

## 9. Bugs discovered

### Bug 1: Malformed JSON body returns 500 instead of 400

**Description:** When a client sends a request with `Content-Type: application/json` and
a body that is not valid JSON (e.g. `{bad json}`), the Express `body-parser` middleware
throws a `SyntaxError` with `statusCode: 400` and `type: 'entity.parse.failed'`. The
global error handler in `app.ts` only handled `HttpError` instances; the `SyntaxError`
fell through to the final branch, which logged it as an unhandled error and returned
`500 Internal Server Error` to the client.

**Impact:** Clients sending malformed JSON receive a misleading 500 response instead
of the expected 400. Stack traces are logged server-side (acceptable), but the status
code is incorrect and the response body says "Internal server error" rather than
indicating a client input problem.

**Root cause:** The body-parser parse error is not an `HttpError`, so the type guard
`error instanceof HttpError` did not match and the error fell through to the generic 500 path.

---

## 10. Fixes implemented

### Fix 1: Detect body-parser parse errors in global error handler

**File:** `apps/server/src/app.ts`

Added a second guard in the global error handler that detects Express/body-parser
`SyntaxError` objects by checking for `type === 'entity.parse.failed'`. When matched,
the handler returns `400 Invalid JSON in request body.` instead of falling through to
the 500 path.

```ts
// body-parser (used by express.json()) throws a SyntaxError with a numeric
// `statusCode` and `type: 'entity.parse.failed'` when the request body is
// malformed JSON. These errors expose a client-supplied status code and
// should be returned as 400, not 500.
if (
  error instanceof SyntaxError &&
  'statusCode' in error &&
  'type' in error &&
  (error as SyntaxError & { type: string }).type === 'entity.parse.failed'
) {
  response.status(400).json({
    status: 'error',
    message: 'Invalid JSON in request body.',
  });
  return;
}
```

**Regression test:** `src/error-handling.test.ts` → "E16: malformed JSON on POST/PATCH/login"
and `src/modules/auth/auth.supplemental.test.ts` → "B1-13 / B2-5" all verify 400 responses.

---

## 11. TypeScript, lint, and formatting results

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ Clean (0 errors) |
| `npm run lint` | ✅ Clean (0 warnings or errors) |
| `npm run format:check` | ✅ All new and modified files pass. 2 pre-existing failures in `.agents/tasks/phase5-test-plan.md` and `plans/README.md` — not introduced by this phase. |

---

## 12. Production build result

```
> @sweety/client@0.1.0 build
> tsc --noEmit && vite build
vite v8.3.8 building client environment for production...
✓ 483 modules transformed.
dist/assets/index-BYMqgm23.js  446.91 kB │ gzip: 140.94 kB
✓ built in 111ms

> @sweety/server@0.1.0 build
> tsc -p tsconfig.build.json
(clean)
```

Both client and server builds succeed cleanly.

---

## 13. Remaining risks or untested scenarios

| Scenario | Note |
|---|---|
| Expired JWT full end-to-end after logout | Current implementation is stateless (JWT-only). Tokens remain cryptographically valid until expiry. No server-side revocation list. The logout test verifies the cookie is cleared client-side; server-side token invalidation is out of scope for this phase. |
| `Math.round` floating-point edge case | `roundToOneDecimal(1.005)` may yield 1.0 instead of 1.1 on some IEEE-754 implementations. Documented in `reports.supplemental.test.ts` as a comment. Not a bug introduced here; existing tests cover the documented behaviour. |
| Database unavailable scenario | Supertest runs against a live test DB. Simulating a mid-request connection failure would require mocking the database layer, which is beyond integration testing scope. |
| Concurrent requests (race conditions) | `fileParallelism: false` prevents cross-suite races. Intra-suite concurrency is not exercised; Supertest requests are sequential per test. |
| Rate limiter under load | `createAuthRateLimiter` is bypassed when `NODE_ENV=test`. The unit tests cover its logic; load testing is out of scope. |
| Frontend localStorage/sessionStorage | Verified at the API level: the JWT is not present in any JSON response field. Full browser-level verification requires end-to-end tooling (Playwright). |
| Asia/Kolkata midnight boundary (integration) | Date boundary tests use fixed past dates. A test running at exactly midnight in IST could theoretically produce a different "today" for seeding vs. the report query. The risk is cosmetic and self-resolves within a second. |
