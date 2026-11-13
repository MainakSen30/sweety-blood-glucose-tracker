# Phase 6 Pre-Implementation Audit

Performed against commit `0f7cfbc` (HEAD, `main`).  
Date: audit run before any Phase 6 files are written.

---

## 1. What already exists vs what is missing

### Already exists

| Item | Location | Notes |
|---|---|---|
| Monorepo + npm workspaces | `package.json` | workspaces: `apps/*` |
| Express server (Phases 1–5) | `apps/server/src/` | Full CRUD, auth, reports, rate limiting |
| React client (Phase 4) | `apps/client/src/` | Landing, auth, dashboard, readings, reports |
| DB schema + 2 migrations | `apps/server/drizzle/` | `users` (0000) + `readings` + enum (0001) |
| Drizzle ORM client | `apps/server/src/database/index.ts` | Pool + `db` export |
| `bcryptjs` hashing | `apps/server/src/modules/auth/auth.repository.ts` | `BCRYPT_COST_FACTOR = 12`; `insertUser` |
| Auth service (register/login) | `apps/server/src/modules/auth/auth.service.ts` | `registerUser`, `loginUser` |
| `date.ts` helpers | `apps/server/src/utils/date.ts` | `todayInAppTimezone`, `parseDDMMYYYY`, `toDDMMYYYY` |
| All API routes | `apps/server/src/modules/*/` | health, auth, readings, reports |
| Docker Compose (3 services) | `docker-compose.yml` | postgres:17, server, client with health checks |
| Server Dockerfile | `apps/server/Dockerfile` | node:22-alpine, dev target |
| Client Dockerfile | `apps/client/Dockerfile` | node:22-alpine, dev target |
| `.env.example` | `.env.example` | Root level, well-populated |
| `.gitignore` | `.gitignore` | `.env` excluded; `.env.example` tracked via `!` rule |
| `.dockerignore` | `.dockerignore` | `.env*` excluded; docs excluded |
| Prettier config | `.prettierrc.json`, `.prettierignore` | Exists |
| ESLint config | `eslint.config.js` | Flat config |
| Phase 5 test report | `.agents/tasks/phase5-testing-report.md` | 148 tests, 9 files |
| `docs/README.md` | `docs/README.md` | Only covers Phase 0 notes |
| `plans/README.md` | `plans/README.md` | Animation plans index |
| `plans/001-landing-entrance.md` | `plans/001-landing-entrance.md` | Landing animation plan |

### Missing for Phase 6

| Item | Status |
|---|---|
| `apps/server/src/database/seed.ts` | **Does not exist** — must be created |
| `db:seed` script in `apps/server/package.json` | **Missing** |
| `db:seed` script in root `package.json` | **Missing** |
| `SEED_DEMO_DATA` env var in `.env.example` | **Missing** |
| Phase 5 coverage in README | README header + TOC only cover Phases 0–4; Phase 5 and 6 absent |
| `docs/screenshots/` directory and screenshots | **Does not exist** — `docs/` contains only `README.md` |
| Playwright | **Not installed** anywhere (see §6) |

---

## 2. Current seed script status

**No seed script exists.** There is no `seed.ts`, `seed.js`, or any file with "seed" in the name anywhere in the repository. The `apps/server/package.json` scripts object has no `db:seed` key; nor does the root `package.json`.

The seed must be created from scratch at:
```
apps/server/src/database/seed.ts
```

---

## 3. `.env.example` gaps vs `env.ts` validated variables

`env.ts` validates these variables via Zod:

| Variable | In `.env.example`? | Notes |
|---|---|---|
| `NODE_ENV` | ✅ | documented |
| `PORT` | ✅ | documented |
| `CLIENT_URL` | ✅ | documented |
| `DATABASE_URL` | ✅ | documented |
| `JWT_SECRET` | ✅ | openssl hint present |
| `JWT_EXPIRES_IN` | ✅ | documented |
| `AUTH_RATE_LIMIT_WINDOW_MS` | ✅ | documented |
| `AUTH_RATE_LIMIT_MAX` | ✅ | documented |
| `TEST_DATABASE_URL` | ✅ | documented (not in env.ts schema; used by vitest.config.ts directly) |
| `POSTGRES_DB / USER / PASSWORD / PORT` | ✅ | Docker-only; documented |
| `SERVER_PORT / CLIENT_PORT` | ✅ | Docker host-port mappings; documented |
| `VITE_API_PROXY_TARGET` | ✅ | documented |
| **`SEED_DEMO_DATA`** | ❌ **MISSING** | New flag required by Phase 6 seed safety requirement |

All currently validated variables are covered. The only gap is the new `SEED_DEMO_DATA=true` opt-in flag that the seed script will require.

The env variable table in the README also covers all variables correctly and is consistent with `env.ts`. No working defaults should be changed.

---

## 4. README current state

- **Header claim:** "Phase 0 … and Phase 4" — Phase 5 is entirely absent; Phase 6 is absent.
- **TOC table:** lists sections for Phase 0–4 only.
- **Phase scope section:** covers Phase 0–4 only; Phase 5 testing & hardening is not mentioned.
- **Scripts table:** `db:seed` is absent (not yet added).
- **Quality checks section:** references "placeholder page" language and understates the test count (reflects pre-Phase-5 state).
- **Tech stack table:** correct and up to date.
- **API sections:** correct and accurate for the implemented endpoints.
- **Repository structure tree:** references `src/pages/HomePage placeholder` — outdated; `HomePage.tsx` does not exist; `LandingPage.tsx`, `DashboardPage.tsx`, `ReadingsPage.tsx`, `ReportsPage.tsx` etc. all exist. The tree in the README is stale.
- **Sections present:** Overview, tech stack, repo structure, prerequisites, install, env config, running locally, scripts, API (health, auth, readings, reports), authentication flow, security, rate limiting, database/Drizzle, Docker, quality checks.
- **Sections absent (required by Phase 6):** Phase 5 scope section, Phase 6 scope section, demo account credentials block, `db:seed` command documentation, screenshots section, testing results summary with actual counts (148 tests), `SEED_DEMO_DATA` env variable row in the table.

---

## 5. `docs/screenshots/` status

The `docs/` directory contains only `docs/README.md`. There is **no `screenshots/` subdirectory** and no image files of any kind (`.png`, `.jpg`, `.webp`, `.gif`). The `public/` directory contains only `favicon.svg`.

Screenshots must be created from scratch. They require the app to be running. Phase 6 must create the directory and either:
- Instruct the reviewer how to capture them manually, or
- Provide placeholder/stub images and instructions.

The Phase 5 report notes: "Frontend localStorage/sessionStorage — Full browser-level verification requires end-to-end tooling (Playwright)." Screenshots are out of scope for automated tooling unless Playwright is available.

---

## 6. Playwright availability

**Playwright is not installed.**

- `apps/client/package.json` `devDependencies`: no `@playwright/test`, no `playwright`.
- Root `package.json` `devDependencies`: no `@playwright/test`, no `playwright`.
- No `playwright.config.ts` or `playwright.config.js` exists in the repository.
- No `e2e/` or `tests/e2e/` directory exists.

Playwright would need to be installed from scratch if end-to-end or screenshot automation is required. The Phase 6 task description does not mandate installing Playwright; screenshots can be supplied as manual captures.

---

## 7. Pre-existing issues from Phase 5 report

The Phase 5 report notes two issues that are **not introduced by Phase 5** and are carried forward:

1. **Prettier failures in `.agents/tasks/phase5-test-plan.md`** — `.agents/tasks/` is not Prettier-formatted prose; this is acceptable but will appear in `format:check` output.
2. **Prettier failures in `plans/README.md`** — same situation.

These two files fail `npm run format:check`. Phase 6 should not introduce new Prettier failures. If the Phase 6 audit file (this file) or the plan files are added to `.prettierignore`, that would resolve the pre-existing failures — but the Phase 5 report explicitly says they were pre-existing and not introduced by Phase 5, so there is no blocker here for Phase 6 work.

No other pre-existing failures were noted. TypeScript, ESLint, and builds are all clean per Phase 5.

---

## 8. Key file paths for the coder step

### Core database / schema

| Purpose | Absolute path |
|---|---|
| Drizzle DB client + Pool | `/Users/mainaksen/projects/sweety/apps/server/src/database/index.ts` |
| DB schema (`users`, `readings`, enums) | `/Users/mainaksen/projects/sweety/apps/server/src/database/schema.ts` |
| Drizzle config | `/Users/mainaksen/projects/sweety/apps/server/drizzle.config.ts` |
| Migration 0000 (users table) | `/Users/mainaksen/projects/sweety/apps/server/drizzle/0000_dry_stone_men.sql` |
| Migration 0001 (readings table) | `/Users/mainaksen/projects/sweety/apps/server/drizzle/0001_glossy_layla_miller.sql` |

### Password hashing

| Purpose | Absolute path |
|---|---|
| `bcryptjs` usage + `BCRYPT_COST_FACTOR = 12` | `/Users/mainaksen/projects/sweety/apps/server/src/modules/auth/auth.repository.ts` |

The seed must call `bcrypt.hash(password, 12)` directly — do **not** call `insertUser()` (which would trigger the duplicate-email `HttpError` path on re-runs). Instead, check for the existing demo user first, then use Drizzle's `db.insert(users)` with a pre-computed hash, identical to the pattern in `insertUser`.

### Date utilities

| Purpose | Absolute path |
|---|---|
| `todayInAppTimezone()`, `parseDDMMYYYY()`, `toDDMMYYYY()` | `/Users/mainaksen/projects/sweety/apps/server/src/utils/date.ts` |

The seed should use `todayInAppTimezone()` as the anchor for relative date calculations so readings are always in the recent past.

### Validation constraints (must be respected in seed data)

- `value`: integer, `BETWEEN 40 AND 600` (from `readings_value_range_check` and `readings.validation.ts`)
- `slot` values: `'morning' | 'after_breakfast' | 'after_lunch' | 'after_dinner'` (from `READING_SLOTS` in `schema.ts`)
- Unique index on `(user_id, reading_date, slot)` — no duplicate slot per day per user
- Maximum 4 readings per day per user (enforced in service layer, but the seed inserts directly so must self-enforce)

### Routes (for README accuracy)

| Module | Absolute path |
|---|---|
| Auth routes | `/Users/mainaksen/projects/sweety/apps/server/src/modules/auth/auth.routes.ts` |
| Readings routes | `/Users/mainaksen/projects/sweety/apps/server/src/modules/readings/readings.routes.ts` |
| Reports routes | `/Users/mainaksen/projects/sweety/apps/server/src/modules/reports/reports.routes.ts` |
| Health route | `/Users/mainaksen/projects/sweety/apps/server/src/modules/health/health.routes.ts` |

### Config / environment

| Purpose | Absolute path |
|---|---|
| Env validation (Zod) | `/Users/mainaksen/projects/sweety/apps/server/src/config/env.ts` |
| Root env example | `/Users/mainaksen/projects/sweety/.env.example` |
| Docker Compose | `/Users/mainaksen/projects/sweety/docker-compose.yml` |
| Root `package.json` (scripts) | `/Users/mainaksen/projects/sweety/package.json` |
| Server `package.json` (scripts) | `/Users/mainaksen/projects/sweety/apps/server/package.json` |

### README

| Purpose | Absolute path |
|---|---|
| Root README (needs Phase 5+6 update) | `/Users/mainaksen/projects/sweety/README.md` |
| Docs README (Phase 0 notes only) | `/Users/mainaksen/projects/sweety/docs/README.md` |

---

## 9. Seed implementation notes for the coder

The seed cannot import `env.ts` directly for the `DATABASE_URL` check because `env.ts` exits the process when `JWT_SECRET` is missing. Instead it should:

1. Load dotenv manually (same pattern as `drizzle.config.ts`: `loadEnvFile({ path: resolve(..., '../../.env') })`).
2. Read `process.env.DATABASE_URL`, `process.env.NODE_ENV`, `process.env.SEED_DEMO_DATA` directly.
3. Create a fresh `Pool` and `drizzle(pool, { schema })` — do not import the shared `pool` from `database/index.ts` to avoid side effects.
4. Close the pool in a `finally` block.

The seed imports `bcryptjs`, `drizzle-orm/node-postgres`, `pg`, the schema, and `src/utils/date.ts` — all already available in the server workspace.

The demo account email to use: `demo@sweety.local`.

Readings generation strategy: use `todayInAppTimezone()` as `T`, then generate readings for `T-1`, `T-2`, ..., `T-30` with varying slot coverage, ensuring at least one full 4-slot day, several partial days, and enough history to exercise all three report types (daily, MTD, previous-month). Insert via `db.insert(readings).values([...]).onConflictDoNothing()` to handle re-runs idempotently.
