# Phase 11 — Redis Integration & Report Caching Report

Date: 14 November 2026
Principle: **PostgreSQL remains the source of truth; Redis is a disposable performance optimization.** Every design decision below follows from that.

---

## A. Executive Summary

**Architecture implemented.** Cache-aside Redis caching (ioredis 6, Redis 7 in Compose) in front of the three existing report endpoints. Reports are computed only by the untouched reporting service against PostgreSQL; Redis stores serialized copies under deterministic, versioned, user-scoped keys. Invalidation is a per-user version counter bumped after every *successful* reading mutation — no wildcard deletions, no SCAN, no locking, no write-through.

**Reports covered.** `GET /api/reports/daily?date`, `GET /api/reports/month-to-date?date`, `GET /api/reports/monthly` (the only report endpoints in the codebase). Reading list/pagination endpoints are not cached (they were not in scope and are cheap indexed queries).

**Overall status: complete.** 28 new backend tests (13 unit + 15 full-app integration) pass; the entire existing suite passes unchanged (server 238/238, client 91/91). Redis failures of every category (read, write, invalidation, connection) were tested at unit and integration level and verified live against a stopped Redis container: reports always serve from PostgreSQL and `/api/health` stays `ok`.

---

## B. Existing Reporting Architecture (inspected, preserved)

### Endpoints and PostgreSQL queries

| Endpoint | Service function | PostgreSQL work |
|---|---|---|
| `GET /api/reports/daily?date=DD-MM-YYYY` | `getDailyReport(userId, isoDate)` | `listReadings(userId, { date })` — one indexed query, already slot-ordered; summary derived from the same rows |
| `GET /api/reports/month-to-date?date=` | `getMonthToDateReport(userId, isoDate)` | `aggregateUserReadings(userId, start, end)` — single indexed `MAX/MIN/AVG/COUNT` aggregate |
| `GET /api/reports/monthly` | `getPreviousMonthReport(userId)` | Same aggregate; the period is derived from *today in Asia/Kolkata* |

- No caching existed anywhere in the application before this phase.
- All three routes are behind `requireAuth`; the user id comes exclusively from `request.authenticatedUserId` (set by the auth middleware from the HTTP-only cookie). No query parameter can influence identity.
- Reading mutations happen in `readings.service.ts` (`createReading`, `updateUserReading`, `deleteUserReading`) — every one of them changes report inputs (aggregates span arbitrary ranges), so each invalidates the mutating user's cache.

---

## C. Redis Infrastructure

### Client library and lifecycle

- **ioredis ^6.0.0** (npm, `apps/server` dependency) — maintained, TypeScript-native.
- `apps/server/src/cache/redisClient.ts`: one shared client created lazily from `env.REDIS_URL`. Connection settings chosen to fail fast rather than hang:
  - `lazyConnect: true` — startup never blocks on Redis; the first report request triggers the connection.
  - `enableOfflineQueue: false` — commands issued while disconnected reject immediately (the cache treats a rejection as a miss → PostgreSQL), instead of queueing during outages.
  - `commandTimeout: 1000`, `connectTimeout: 3000` — bounded waits.
  - `retryStrategy` capped at 3s backoff — bounded reconnect rate with automatic recovery.
  - `error` events are logged (`Redis cache error: …`), never fatal; credentials never appear in logs (`showFriendlyErrorStack: false`).
- `closeRedis()` runs during graceful server shutdown (`server.ts`), after the PostgreSQL pool closes.

### Docker Compose changes

- New `redis` service: `redis:7-alpine`, `command: redis-server --save '' --appendonly no` (persistence deliberately disabled — cache data is disposable), `redis-cli ping` healthcheck, **internal network only** (no host port), **no volume**.
- `server` gets `REDIS_URL: redis://redis:6379` (internal hostname) and `REDIS_CACHE_TTL_SECONDS: 60`, and `depends_on: redis: service_healthy`. Compose ordering is a convenience, not a hard runtime dependency — the application tolerates Redis being stopped (verified live).

### Environment configuration

| Variable | Validation | Default | Meaning |
|---|---|---|---|
| `REDIS_URL` | Optional; must parse as `redis://`/`rediss://` URL when set | unset (**caching disabled**) | Redis connection for report caching |
| `REDIS_CACHE_TTL_SECONDS` | Positive whole integer (Zod) | `60` | Expiration of every cached report |

Both documented in `.env.example` (Docker default `redis://redis:6379`; host-local `redis://localhost:6379`; unset = off). No Redis credentials are exposed to the frontend or to Docker build args.

### Health-check behaviour

`GET /api/health` remains `200 {status:'ok'}` — a Redis outage cannot make a working API report itself unhealthy. It now includes informational, non-sensitive cache data:

```json
"cache": { "redis": "disabled | connecting | ready | down", "hits": n, "misses": n, "errors": n }
```

No credentials, cache keys, or cached contents are exposed.

---

## D. Cache Design

### Cache-aside flow

1. Controller validates the query (dates normalized to internal `YYYY-MM-DD` by the existing Zod schemas).
2. `reports.cache.ts` builds key parts: authenticated `userId` + report type + normalized period.
3. Cache layer reads the user's version counter, then the key. **Hit:** JSON is returned — no PostgreSQL query runs. **Miss:** the existing service computes from PostgreSQL; the result is stored with `EX <TTL>` and returned.
4. Any Redis error at any step: logged, counted in `stats.errors`, and the PostgreSQL result is returned as if the cache did not exist. Cache methods never throw.
5. With `REDIS_URL` unset the client is `null` and every read goes straight to the loader.

### Key format

```
sweety:v1:reports:u{userId}:v{version}:daily:{YYYY-MM-DD}
sweety:v1:reports:u{userId}:v{version}:month-to-date:{YYYY-MM-DD}
sweety:v1:reports:u{userId}:v{version}:monthly:{startISO}:{endISO}
```

- Versioned (`v1`) so future schema changes can bump the prefix safely.
- The monthly key embeds its computed period, so the Asia/Kolkata midnight rollover naturally produces a new key (tested).
- User id comes only from the auth middleware — user isolation is structural, and tested.
- Keys contain ids and dates only — no PII beyond the internal user UUID, no tokens.

### TTL

60 seconds (default), applied to **every** `SET` via `EX`. Rationale: report inputs change only on reading mutations, which actively invalidate; the TTL is purely a bound on worst-case staleness and on memory growth, so a short, single, uniform value is correct. Configurable via `REDIS_CACHE_TTL_SECONDS` (validated ≥ 1); no entry is ever written without expiration.

### Serialization

`JSON.stringify`/`JSON.parse`. Report DTOs contain only strings, numbers, nulls, and arrays — the round-trip is lossless (asserted by deep-equality hit tests).

---

## E. Invalidation Strategy

**Mechanism: per-user generation counter.**

- `sweety:v1:user-version:u{userId}` — read on every report request (1 cheap `GET`), bumped with `INCR` after each successful mutation.
- Bumping the counter instantly orphans **all** of that user's cached entries regardless of report type, date, or range — no key enumeration, no wildcard deletion, and other users are untouched.
- Orphaned entries expire within the TTL on their own.

**Integration points:** `readings.service.ts` calls `invalidateUserReportCache(userId)` *after* `insertReading`/`updateReading`/`deleteReading` succeed — never before. Every failure path (validation 400, duplicate slot 409, daily-limit 409, missing reading 404) throws before the invalidation line.

**Redis-failure behaviour (the case the task flags):**

- The invalidation helper is fire-safe: `INCR` failures are logged and counted, and the mutation response is unaffected (tested: 201 returned while `INCR` rejects).
- If Redis is **fully down** during a mutation: the mutation still succeeds, and because cache *reads* also fail while Redis is down, reports are served **fresh from PostgreSQL** — no stale data can be served during the outage itself (tested).
- **Documented limitation:** if an invalidation `INCR` fails *transiently* (Redis reachable again before the next read — e.g. the connection flaps), a previously cached entry can be served for at most `REDIS_CACHE_TTL_SECONDS` (60s) before it self-corrects; the next successful mutation restores immediate freshness. Strict immediate consistency is impossible without a durable invalidation log (a Redis write that itself failed); the TTL bound is the chosen safe fallback, tested and stated rather than silently claimed.

---

## F. Testing Results

New suites: `src/cache/reportCache.test.ts` (13 unit tests, in-memory Redis double with deterministic per-operation failures) and `src/modules/reports/reports.cache.wiring.test.ts` (15 full-app tests: Supertest → routing → auth → cache → real PostgreSQL test database, with only the Redis client seam replaced). All other suites untouched.

| Test category | Result | Details |
|---|---|---|
| Cache hits | **PASS** | Second identical request returns identical body without re-running the report query (unit + app-level) |
| Cache misses | **PASS** | Miss runs the loader, stores the JSON, returns correct data |
| TTL | **PASS** | Every `SET` recorded with `EX` and the configured seconds (60 default, 120 custom); invalidation → repopulation also TTL-stamped |
| User isolation | **PASS** | Two users, identical params → distinct keys; B receives B's (empty) data, never A's cached report; user id verified in every key pattern; identity comes from middleware only |
| Create invalidation | **PASS** | After 201, report shows the new reading immediately (unit + app) |
| Update invalidation | **PASS** | PATCH → report shows the new value immediately |
| Delete invalidation | **PASS** | DELETE → report reflects the removal immediately |
| Failed mutation | **PASS** | 409 duplicate-slot create → cache entry still served, no new PostgreSQL query |
| One user's mutation ≠ another's cache | **PASS** | B's cached report survives A's mutation; A's next read recomputes |
| Period reports (MTD/monthly) | **PASS** | Both aggregate endpoints hit/miss/invalidation behave identically; monthly key embeds its computed period |
| Redis read failure | **PASS** | Report served from PostgreSQL, `errors` incremented, user unaffected |
| Redis write failure | **PASS** | Correct response; nothing cached; next request recomputes |
| Invalidation failure | **PASS** | Mutation still 201; stale window bounded by TTL (unit) |
| Full outage + recovery | **PASS** | During outage: fresh PostgreSQL data served. After recovery: TTL-bounded staleness window demonstrated, next mutation restores immediate freshness |
| Health observability | **PASS** | `cache.redis` status + hits/misses/errors; `200 ok` preserved |
| Existing backend tests | **PASS** | 238/238 across 13 files (210 pre-existing incl. one updated health-contract test + 28 new) |
| Frontend suite | **PASS** | 91/91 (no frontend changes; regression check) |

---

## G. Performance Verification

**Primary proof — database query invocation counts** (repository spies over real PostgreSQL):

| Scenario | Report query invocations |
|---|---|
| First request (miss) | 1 |
| Second identical request (hit) | still 1 — no repeat |
| After create/update/delete (invalidation) | 2 — recomputed once |
| Different date/type | separate key, own computation |
| Failed mutation between reads | still 1 — cache preserved |

**Live Docker verification** (dev stack, demo user, 76 seeded readings):

- `GET /api/reports/monthly`: miss **15.8 ms** → hit **3.7 ms** → hit **2.7 ms** (~4–6× on this small dataset; absolute numbers are modest because the aggregate is a single indexed query over 76 rows).
- `/api/health` counters progressed exactly as designed: `{misses:1}` on first request, `{hits:1}` after the second; `{errors:1}` recorded the pre-connection fallback on the very first request ("Stream isn't writeable and enableOfflineQueue options is false" → PostgreSQL served the report) — a live demonstration of the failure path.
- `redis-cli --scan` showed only the designed key shapes: `sweety:v1:reports:u{uuid}:v{0..2}:{type}:{period}` plus the user-version key.
- Live invalidation round-trip: report 0 readings → create (201) → report 1 reading avg 101 → delete (200) → report 0 again, with versions bumping v0→v1→v2 in Redis. Cleanup: created reading deleted, DB back to baseline.
- Live outage: `docker compose stop redis` → MTD and daily reports still `200` with correct data (`errors` counter climbing, health stays `ok`); Redis restarted, caching resumed.

Environment: Docker Compose on macOS, Redis 7-alpine, PostgreSQL 17, 76-reading dataset, server-rendered timings via `curl -w %{time_total}`. No fabricated benchmarks; timing values are indicative only for a dev-sized dataset.

---

## H. Documentation Changes

- **README.md:**
  - New **"Report caching (Redis)"** section: architecture, key format, TTL, invalidation + consistency guarantees, safe cache-clearing commands (`redis-cli FLUSHDB`, `docker compose restart redis`), and Redis troubleshooting.
  - "Run SWEETy Locally with Docker": four services, Redis row in the ports table (internal-only), updated health-gated startup chain.
  - Environment variable reference: `REDIS_URL`, `REDIS_CACHE_TTL_SECONDS`.
  - Testing section: report-caching test coverage bullets.
  - Project phases: Phase 10 (frontend testing) and Phase 11 (Redis caching) entries; intro updated to Phase 0–11; test count corrected to 329 across 22 files (verified by the actual runs).
- **.env.example:** new "Redis report cache" block with the Docker default, the host-local alternative, TTL, and the "leave empty to disable" note.
- All documented Docker commands were verified against the running stack.

---

## I. Files Changed

| File | Purpose |
|---|---|
| `apps/server/package.json`, `package-lock.json` | Added `ioredis ^6.0.0` |
| `apps/server/src/config/env.ts` | Optional `REDIS_URL` (redis/rediss URL) + `REDIS_CACHE_TTL_SECONDS` (positive int, default 60) |
| `apps/server/src/cache/redisClient.ts` | **New** — shared ioredis client lifecycle: fail-fast options, bounded retries, non-fatal error logging, status, graceful close |
| `apps/server/src/cache/reportCache.ts` | **New** — cache-aside factory (injectable client + TTL), key builder, JSON serialization, user-version invalidation, hit/miss/error counters; app-wide instance; `invalidateUserReportCache` hook |
| `apps/server/src/cache/reportCache.test.ts` | **New** — 13 unit tests: keys, hits/misses, TTL, isolation, invalidation, all failure modes, counters |
| `apps/server/src/modules/reports/reports.cache.ts` | **New** — cached composition of the three report service functions (cache keys from authenticated identity + normalized dates) |
| `apps/server/src/modules/reports/reports.controller.ts` | Calls the cached wrappers; business logic untouched |
| `apps/server/src/modules/reports/reports.cache.wiring.test.ts` | **New** — 15 full-app integration tests with real PostgreSQL and a Redis test double |
| `apps/server/src/modules/readings/readings.service.ts` | Post-success `invalidateUserReportCache(userId)` on create/update/delete |
| `apps/server/src/modules/health/health.routes.ts` | Informational `cache` block (status + counters); liveness unchanged |
| `apps/server/src/server.ts` | `closeRedis()` in graceful shutdown |
| `apps/server/src/app.test.ts` | Health test updated for the extended (documented) response contract |
| `docker-compose.yml` | `redis` service (internal-only, no persistence, healthcheck), server `REDIS_URL`/TTL env, `depends_on` |
| `.env.example` | Redis configuration block |
| `README.md` | As detailed in §H |
| `.agents/tasks/phase11-redis-report-caching.md` | This report |

---

## J. Remaining Limitations

1. **TTL-bounded staleness window:** a transiently failed invalidation (Redis reachable at read time) can serve a cached report for up to 60s; strict immediate consistency in that edge is impossible without durable invalidation logging (out of scope). Documented and tested, not hidden.
2. **No Redis persistence** (deliberate): a Redis restart empties the cache; reports recompute from PostgreSQL.
3. **Single Redis instance**, no TLS/auth in the local Compose network (internal-only); production-grade hardening is out of scope for this phase.
4. **Rate limiting remains in-memory** — the README's "not suitable for multi-instance deployments without a shared store (e.g. Redis)" limitation still stands; Redis was introduced for report caching only.
5. **Latency figures are dev-scale** (76 readings, local containers); they demonstrate hit-vs-miss behaviour, not production throughput.
6. **Redis is not exposed to the host** by design; inspection happens via `docker compose exec redis redis-cli` (documented).
7. Phase 8–10 uncommitted work preserved; nothing committed or pushed.
