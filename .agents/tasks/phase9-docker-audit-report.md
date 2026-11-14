# Phase 9 — Docker Audit & Reviewer Readiness Report

Date: 14 November 2026
Scope: audit and verification of the existing Docker Compose local development / reviewer experience. Production deployment explicitly out of scope. The demo seed script was **not** executed and no destructive command touched the real database volume.

---

## A. Executive Summary

**Overall Docker readiness: good.** The existing Docker setup was already well built — three development services (PostgreSQL 17, Express API, Vite dev server) with health checks, dependency ordering, a named data volume, and bind-mounted source for hot reload. It required only one genuine fix plus documentation.

**A reviewer can reproduce the application locally.** The full flow — clone → `cp .env.example .env` → set `JWT_SECRET` and `POSTGRES_PASSWORD` → `docker compose up -d --build` → `docker compose exec server npm run db:migrate` → optional explicitly opt-in seed → open <http://localhost:5173> — was verified end-to-end, including on an isolated, disposable stack started from a completely fresh database.

**Issues discovered:** one real issue (Compose silently passed an empty `JWT_SECRET`, producing a confusing server-side validation failure on first run — fixed with a Compose-level fail-fast) and one documentation gap (no dedicated Docker reviewer walkthrough in README; outdated phase references and test counts). Everything else was audited and found correct, and was left unchanged.

---

## B. Existing Docker Architecture (audited, preserved)

### Compose services (`docker-compose.yml`, project name `sweety`)

| Service | Image / target | Internal port | Host port | Health check |
|---|---|---|---|---|
| `postgres` | `postgres:17-alpine` | 5432 | `POSTGRES_PORT` (default 5432) | `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`, 5 s interval, 10 retries |
| `server` | `apps/server/Dockerfile` → `development` | 5000 | `SERVER_PORT` (default 5000) | Node `fetch` on `http://127.0.0.1:5000/api/health` |
| `client` | `apps/client/Dockerfile` → `development` | 5173 | `CLIENT_PORT` (default 5173) | Node `fetch` on `http://127.0.0.1:5173` |

Dependency order: `server` depends on `postgres: service_healthy`; `client` depends on `server: service_healthy`. Verified live: during startup the client does not start until the server reports healthy.

### Dockerfiles

Both Dockerfiles (`apps/server/Dockerfile`, `apps/client/Dockerfile`) use the same sound pattern:

- `node:22-alpine` base; `deps` stage runs `npm ci` with all three workspace `package.json` files copied (root, client, server) and pre-creates `apps/*/node_modules` so bind mounts cannot shadow installed dependencies.
- `development` stage copies `node_modules` from `deps` with `--chown=node:node`, copies root config + app source, runs as `USER node`, and starts the respective `npm run dev` workspace command.
- Images were rebuilt successfully during this audit (`docker compose build` — both images built clean).

### Networking

Single user-defined bridge network `sweety-network`. The server reaches PostgreSQL via the service hostname `postgres:5432` (Compose-injected `DATABASE_URL`), and the client proxies `/api` requests to `http://server:5000` (`VITE_API_PROXY_TARGET` set by Compose — verified inside the running container). From the browser, all API traffic flows through the Vite dev-server proxy at the same origin, so no CORS involvement and no cross-origin cookie problems in the Docker flow. CORS (`origin: env.CLIENT_URL`, `credentials: true`) covers any direct-API usage from the browser.

### Volumes

Named volume `sweety_postgres_data` mounted at `/var/lib/postgresql/data`. Data is not stored in the disposable container filesystem. Verified: `docker volume inspect sweety_postgres_data` shows a persistent mount point, and data survived every restart/recreation test below.

### `.dockerignore`

Excludes `node_modules`, `.git`, `.env` and `.env.*` (all patterns, including `**/.env*`), build artifacts, logs, and docs. Verified: no `.env` or secrets enter the build context or images.

---

## C. Issues Found

| # | Severity | Location | Issue | Resolution |
|---|---|---|---|---|
| 1 | **Medium** | `docker-compose.yml`, `server.environment.JWT_SECRET` | `${JWT_SECRET:-}` silently defaulted to an **empty string** when the variable was unset. Compose started, then the server crashed with Zod's `JWT_SECRET must be at least 32 characters long` — a confusing first-run failure, and the misconfiguration was invisible at orchestration level. | **Fixed:** replaced with `${JWT_SECRET:?JWT_SECRET is missing - copy .env.example to .env and set a value of at least 32 characters (see README)}`. Verified: with `JWT_SECRET` unset, `docker compose config` now fails fast with that exact message; with `.env` present, config validates and the stack runs. |
| 2 | **Low (docs)** | `README.md` | Intro claimed "Phase 0 through Phase 7" (stale); test count said 271 (actual 273); no dedicated Docker reviewer walkthrough section. | **Fixed:** intro now covers Phase 0–9; test count corrected to 273 (verified by the actual suite run); added the "Run SWEETy Locally with Docker" section (see §H). |
| 3 | **Info / optional hardening** | `docker-compose.yml` | No `restart:` policy on services; a Docker daemon restart leaves the stack stopped. | Not changed — this is a development stack, and an automatic restart policy is a production concern. Documented in this report as optional hardening only. |
| 4 | **Non-issue (audit tooling)** | temporary audit Compose file | The initial isolated audit stack failed with `dependency failed to start: container ... has no healthcheck configured` — the temporary file had omitted the healthchecks the real compose defines. | Error in the temporary audit file, **not** a repository bug; corrected in the temp file (which was deleted after use). Repo compose was always correct. |

Everything else audited — env var plumbing, migration config, seed guards, auth cookie/CORS/proxy wiring, bind mounts, volume config, `.dockerignore`, Vite proxy — was correct and was **left unchanged**.

---

## D. Environment Configuration

### Variables actually used by the application (verified against `.env.example`, `docker-compose.yml`, `env.ts`, and the client)

| Variable | Where used | Docker behaviour | Default |
|---|---|---|---|
| `JWT_SECRET` | server validation (`≥32` chars, enforced by Zod) | **Now required by Compose** (`:?` fail-fast) | none |
| `DATABASE_URL` | server, drizzle-kit | Compose injects `postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB` — host value not needed in containers | none (host) |
| `TEST_DATABASE_URL` | Vitest only | Not used by Docker or the seed script (verified) | none |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | postgres + server services | Interpolated by Compose | `sweety` / `sweety` / none (placeholder `change_me` in `.env.example`) |
| `JWT_EXPIRES_IN` | server | `${JWT_EXPIRES_IN:-1h}` | `1h` |
| `CLIENT_URL` | server CORS | `${CLIENT_URL:-http://localhost:5173}` | `http://localhost:5173` |
| `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX` | server rate limiter | Compose defaults `900000` / `20` | same |
| `NODE_ENV` / `PORT` | server | Pinned by Compose (`development` / `5000`) | `development` / `5000` |
| `POSTGRES_PORT` / `SERVER_PORT` / `CLIENT_PORT` | host port mappings | `.env` → Compose | `5432` / `5000` / `5173` |
| `VITE_API_PROXY_TARGET` | client Vite proxy | Compose overrides with `http://server:5000` (verified in container) | `http://localhost:5000` |
| `SEED_DEMO_DATA` | seed script opt-in | Never set by Compose — explicit opt-in only | unset |

### Secret handling

- `.env` is git-ignored and excluded from Docker build context by `.dockerignore` (`.env`, `.env.*`, `**/.env*`) — verified: no env file is copied into images (images only contain `package.json`/source).
- `.env.example` contains placeholders only (`change_me` for `POSTGRES_PASSWORD`); no real credentials.
- JWT secret validation exists at two levels: Compose fail-fast (new) and server Zod `≥32` chars (existing, unchanged).
- Local development defaults (dev password, short token lifetime) are clearly labelled as such in README and `.env.example`; nothing insecure was introduced and no authentication defaults were weakened.

---

## E. Database and Seed Workflow

### Migration workflow

- Migrations are committed: `apps/server/drizzle/0000_dry_stone_men.sql` (users table), `0001_glossy_layla_miller.sql` (readings table + `reading_slot` enum) plus `meta/_journal.json`. No replacement with `drizzle-kit push`; no automatic schema changes at startup (the server only runs `SELECT 1` connectivity check).
- **Verified command for Docker reviewers:** `docker compose exec server npm run db:migrate`
  - Works because Compose injects `DATABASE_URL` into the server container (the host-side `/app/.env` is absent in the image but not needed — verified).
  - `tsx` and `drizzle-kit` confirmed present in `/app/node_modules/.bin`.
  - Verified **idempotent** on the existing dev database (re-run applies nothing).
  - Verified on a **completely fresh database** via the isolated disposable stack (see §G/§I): both migrations applied, `users = 0`, `readings = 0` — confirming no auto-seeding and no schema drift.
- Failures are visible: `drizzle-kit migrate` prints the failing statement and exits non-zero.

### Seed script safety audit (code audit only — **never executed**)

`apps/server/src/database/seed.ts` guards, all confirmed present and unchanged:

1. `NODE_ENV !== 'production'` required.
2. `SEED_DEMO_DATA` must be exactly `true` — the npm script `db:seed` never sets it.
3. `DATABASE_URL` database name must be on the explicit allowlist (`sweety`, `sweety_dev`, `sweety_demo`); `_test`/`-test` suffixed names always rejected.
4. `TEST_DATABASE_URL` is never used.
5. No TRUNCATE/DROP/DELETE against user data.
6. Existing demo account password never overwritten.
7. All inserts `ON CONFLICT DO NOTHING` → idempotent.
8. Connection closed in a `finally` block.

Guard coverage: dedicated unit tests exist (`seed.guards.test.ts`, `seed.test.ts`) and pass in the suite. The script is wired nowhere in Compose — nothing seeds automatically at startup (verified on the fresh-DB isolated stack: 0 users after `up`).

### Exact documented reviewer commands

```bash
docker compose exec server npm run db:migrate
docker compose exec server sh -c "SEED_DEMO_DATA=true /app/node_modules/.bin/tsx /app/apps/server/src/database/seed.ts"
```

Demo credentials (`demo@sweety.local` / `Demo1234!`) match the seed implementation and were additionally confirmed by an actual successful login.

**Confirmation: the seed script was not executed during this phase, against any database.**

---

## F. Authentication Verification

No authentication code was changed. Verified live through the running Docker stack (requests via the Vite proxy on port 5173 unless noted):

| Check | Result |
|---|---|
| `POST /api/auth/login` (valid demo credentials) | 200, session cookie issued |
| Cookie flags (observed header) | `HttpOnly; SameSite=Lax; Path=/; Max-Age=3600` — HTTP-only, no `Secure` in development, compatible with the same-origin proxy architecture |
| `GET /api/auth/me` with cookie | 200 |
| `GET /api/auth/me` without cookie | 401 |
| `POST /api/auth/logout` | 200; clears cookie with `Expires=Thu, 01 Jan 1970`; subsequent `/me` → 401 |
| Session survives container restarts | Yes (stateless JWT; verified across restart + recreation tests) |
| Ownership isolation | Probe user (`docker-audit-9@sweety.local`, registered via API) saw 0 readings; requesting the demo user's reading id → 404 |
| Browser-level flow (headless Chrome) | Unauthenticated `/today` → redirect `/login`; login form → authenticated dashboard; `/me` 200; logout → redirect to `/login` |

---

## G. Persistence Verification

Volume: named `sweety_postgres_data` (explicitly named in compose — a second compose project cannot silently share it).

| Test | Result |
|---|---|
| Full `docker compose restart` (all three services) | All `(healthy)` again; JWT session + all readings intact |
| `docker compose up -d --force-recreate --no-deps postgres` (container destroyed & recreated on same volume) | New container created (verified timestamp); data + session intact |
| Full `docker compose down` (containers + network removed) → `docker compose up -d` | Volume preserved (verified `docker volume ls` between the two); all data + login intact after re-up |
| `docker compose down -v` | **Never run against the real volume.** Destructive semantics were verified only on the isolated disposable stack (`sweety_audit9_postgres_data` removed; `sweety_postgres_data` untouched) |

The isolated fresh-start stack (`sweety-audit9` — own project name, own volume `sweety_audit9_postgres_data`, ports 5434/5002/5174, random `JWT_SECRET`) verified the complete clean-clone experience: `up -d --build` from nothing → health-gated startup → fresh migrations → `users = 0` (no auto-seed) → register/login/create/list/delete/logout through the API (all 200/201/401 as expected) → main volume untouched → `down -v` removed only the disposable volume → `sweety_postgres_data` still intact (demo login still 200).

Note: the ownership-isolation probe user `docker-audit-9@sweety.local` remains in the development database (registered via the public API; no SQL deletes were performed per safety rules). It is inert (0 readings) and harmless.

---

## H. README Changes

`README.md` updated (Prettier-formatted; no documentation removed):

1. **Intro** — "Phase 0 through Phase 7" → "Phase 0 through Phase 9" (adds reports/data visualization and Docker reviewer readiness).
2. **Table of contents** — added "Run SWEETy Locally with Docker".
3. **New section "Run SWEETy Locally with Docker"** (after Prerequisites) with the full verified reviewer flow: Prerequisites (Docker + Git only — no Node/npm needed) → clone → `cp .env.example .env` (table of the two must-set variables) → `docker compose up -d --build` + `docker compose ps` (service/port tables) → `docker compose exec server npm run db:migrate` → optional opt-in seed + demo credentials → open app/health URLs → useful commands with the `down` vs `down -v` destructive-volume warning and restart/recreate persistence notes → troubleshooting (port conflicts incl. macOS AirPlay, invalid JWT secret, DB connection failures, migration failures, proxy failures, cookie problems, volume issues). Every documented command was executed during this audit; nothing unverified is documented.
4. **Database setup** — cross-reference to the in-container migration command.
5. **Running the application → Docker Compose** — pointer to the new walkthrough section.
6. **Testing** — test count corrected 271 → 273.
7. **Project phases** — added "Phase 9 — Docker audit and reviewer readiness".

Remaining manual steps for reviewers: create `.env` from `.env.example`, set `JWT_SECRET` (generate with `openssl rand -hex 32`) and replace the `POSTGRES_PASSWORD` placeholder, decide whether to run the optional seed. Everything else is zero-config.

---

## I. Test Results

| Check | Result | Details |
|---|---|---|
| Compose configuration | **PASS** | `docker compose config --quiet` clean; negative test: unset/empty `JWT_SECRET` now rejected with the fail-fast message (runtime-verified) |
| Docker image builds | **PASS** | `docker compose build` — both development images built clean (Docker 29, BuildKit) |
| PostgreSQL health | **PASS** | `pg_isready` healthcheck; container `(healthy)` across all tests |
| Backend health | **PASS** | `/api/health` 200 direct (mapped host port) and via Vite proxy |
| Frontend availability | **PASS** | Vite serving on mapped port; page title + React root render (headless Chrome) |
| Database migrations | **PASS** | Idempotent on dev DB; both migrations applied on a fresh DB (isolated stack, `users=0` after) |
| Authentication | **PASS** | Login/logout/`me` through the proxy with correct cookie flags; ownership isolation verified (probe user) |
| Readings CRUD | **PASS** | Create ×2 (201), list by date, PATCH (200), DELETE (200); domain rules hold: value 700 → 400, future date → 400 |
| Reports and charts | **PASS** | API: daily (avg 106), month-to-date (01-11→14-11, total 32), previous month (01-10→31-10, total 45), empty-day report (`readings: 0`, `avg: null`). Frontend: Daily/MTD/Previous-month tabs render; previous-month shows 43 readings, avg 118.5, trend + donut SVG charts render |
| Pagination | **PASS** | API: page 8/limit 10 → 7 items, total 77 (with the 2 temporary readings), correct pagination metadata. Frontend: "Page 1 of 4" with Previous/Next controls |
| Database persistence | **PASS** | Survived: full `restart`, postgres container force-recreate, full `down` + `up` cycle (volume preserved; data + session intact) |
| Existing automated tests | **PASS** | 273/273 (63 client across 9 files + 210 server across 11 files); typecheck, ESLint, Prettier all clean |
| Clean startup (fresh DB, isolated stack) | **PASS** | Health-gated startup, fresh migrations, no auto-seed, full API round-trip, main volume untouched, disposable volume removed |
| Seed script execution | **NOT RUN** | Deliberate — safety rules forbid executing it; guards verified by code audit + dedicated unit tests |
| `down -v` on the real `sweety_postgres_data` volume | **NOT RUN** | Deliberate — destructive; verified only on the disposable stack's volume |

Distinguishing: *static inspection* = all config/code audits (§B, §D, §E, §F cookie config); *automated testing* = 273-test suite, seed-guard unit tests, typecheck/lint/prettier; *runtime verification* = everything in §F, §G and this table marked PASS (actual Docker + HTTP + headless-browser execution).

---

## J. Final Reviewer Instructions

```bash
# 1. Clone
git clone https://github.com/MainakSen30/sweety-blood-glucose-tracker.git
cd sweety-blood-glucose-tracker

# 2. Configure environment
cp .env.example .env
#   set JWT_SECRET        (≥32 chars, e.g. openssl rand -hex 32)
#   set POSTGRES_PASSWORD (replace the change_me placeholder)

# 3. Start the stack (postgres → server → client, health-gated)
docker compose up -d --build
docker compose ps                      # wait for all three "(healthy)"

# 4. Initialize the database schema (required, idempotent)
docker compose exec server npm run db:migrate

# 5. Optional but recommended: seed demo data (explicit opt-in, idempotent)
docker compose exec server sh -c "SEED_DEMO_DATA=true /app/node_modules/.bin/tsx /app/apps/server/src/database/seed.ts"

# 6. Open and log in
#    http://localhost:5173  —  demo@sweety.local / Demo1234!
```

Routine maintenance: `docker compose logs -f [service]`, `docker compose ps`, `docker compose restart`, `docker compose stop`. Stopping: `docker compose down` keeps all data in the `sweety_postgres_data` volume; `docker compose down -v` **deletes the database** — use only when intentionally resetting.

---

## K. Remaining Limitations

1. **Seed script was never executed** (per phase rules). Its behaviour is verified by code audit and its dedicated unit tests only; the seeded demo account/credentials were confirmed against the code and by logging in with the pre-existing demo data.
2. **`down -v` was never run against the real volume** — destructive-removal semantics were verified on the isolated disposable stack's volume only.
3. **No `restart:` policy** was added — an intentional, documented omission for a development stack; a reviewer's machine that reboots will need `docker compose up -d` again.
4. **Browser verification was headless Chrome (CDP)** on the Vite dev server; real-browser/device matrix and production builds served by a web server are out of scope (production deployment excluded from this phase).
5. **The probe account `docker-audit-9@sweety.local` remains in the dev database** (created through the public API; removing it would have required direct SQL deletes, which were out of bounds). It has zero readings and does not affect the demo experience.
6. **Static inspection only** for: Docker daemon-level restart behaviour (host reboot) and IPv6-specific port binding quirks; neither affects the documented workflow.
7. **Phase 8 animation fixes** present in the working tree were preserved untouched; per instructions, nothing was committed or pushed.
