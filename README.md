# Sweety – Blood Glucose Tracker

Sweety is a full-stack web application that will let a diabetes patient record up to four blood
glucose readings per day and review daily and monthly reports.

This repository contains **Phase 0: project foundation**, **Phase 1: authentication and user
foundation**, **Phase 2: blood glucose readings**, **Phase 3: report generation and analytics**, and
**Phase 4: frontend implementation and visual design**. It provides the monorepo, tooling,
configuration, Docker-based development environment, a `users`
table, cookie-based JWT authentication (`register`, `login`, `me`, `logout`), a complete
authenticated CRUD API for blood glucose readings, daily / month-to-date / previous-month
report endpoints backed by PostgreSQL aggregation, and the full React frontend — authentication
screens, dashboard, reading management, and reports with visualisations. Doctor roles are
intentionally not implemented.

## Where to find what

| Looking for…                                            | Section                                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 scope                                           | [Phase scope → Phase 0 (foundation)](#phase-scope)                                                                                            |
| Phase 1 — what was built & implementation notes         | [Phase scope → Phase 1](#phase-1-authentication-and-user-foundation) and [Phase 1 implementation notes](#phase-1-implementation-notes)        |
| Phase 2 — what was built & implementation notes         | [Phase scope → Phase 2](#phase-2-blood-glucose-readings) and [Phase 2 implementation notes](#phase-2-implementation-notes)                    |
| Phase 3 — what was built & implementation notes         | [Phase scope → Phase 3](#phase-3-report-generation-and-analytics) and [Phase 3 implementation notes](#phase-3-implementation-notes)           |
| Phase 4 — what was built & implementation notes         | [Phase scope → Phase 4](#phase-4-frontend-implementation-and-visual-design) and [Phase 4 implementation notes](#phase-4-implementation-notes) |
| Design system (colours, typography, motion)             | [Design system](#design-system)                                                                                                               |
| Report endpoints, empty behavior, rounding, date ranges | [Blood glucose reports](#blood-glucose-reports)                                                                                               |
| API endpoints and payloads                              | [API](#api)                                                                                                                                   |
| Authentication flow, cookies, security, rate limiting   | [Authentication flow](#authentication-flow)                                                                                                   |
| Database schema and migrations                          | [Database and Drizzle](#database-and-drizzle)                                                                                                 |
| Reading data model, slots, validation, timezone         | [Blood glucose readings](#blood-glucose-readings)                                                                                             |
| Running, testing, Docker, ports                         | [Running locally](#running-locally), [Testing setup](#testing-setup), [Docker development](#docker-development)                               |
| Assumptions and known limitations                       | [Assumptions](#assumptions), [Security decisions and limitations](#security-decisions-and-limitations)                                        |

## Tech stack

| Area         | Technology                                                           |
| ------------ | -------------------------------------------------------------------- |
| Frontend     | React 19, TypeScript 5.9, Vite 8, React Router 7, Tailwind CSS 4     |
| Backend      | Node.js 22, Express 5, TypeScript 5.9, Zod 4, bcryptjs, jsonwebtoken |
| Database     | PostgreSQL 17 (Docker), Drizzle ORM 0.45, `pg`                       |
| Testing      | Vitest 4, React Testing Library, Supertest, jsdom                    |
| Code quality | ESLint 10 (flat config), Prettier 3, strict TypeScript               |
| Dev tooling  | npm workspaces, `concurrently`, `tsx`                                |
| Containers   | Docker Compose with separate client, server, and PostgreSQL services |

**Package manager:** npm. The project was originally scoped with Bun, but the Docker requirement
specified Node.js and npm; npm workspaces are therefore used consistently.

## Repository structure

```text
sweety/
├── apps/
│   ├── client/
│   │   ├── src/
│   │   │   ├── components/          # Placeholder for future components
│   │   │   ├── pages/               # HomePage placeholder
│   │   │   ├── hooks/               # Placeholder for future hooks
│   │   │   ├── services/            # Typed API clients (authApi.ts, readingsApi.ts, http.ts)
│   │   │   ├── types/               # Client types (user.ts, reading.ts)
│   │   │   ├── lib/                 # Placeholder for future utilities
│   │   │   ├── App.tsx
│   │   │   ├── App.test.tsx
│   │   │   ├── index.css
│   │   │   ├── main.tsx
│   │   │   └── setupTests.ts
│   │   ├── Dockerfile
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── server/
│       ├── src/
│       │   ├── config/env.ts
│       │   ├── database/
│       │   │   ├── index.ts
│       │   │   └── schema.ts
│       │   ├── middleware/          # auth.ts (JWT), rate-limit.ts
│       │   ├── modules/
│       │   │   ├── auth/            # routes, controller, service, repository, validation, types, tokens, tests
│       │   │   ├── health/health.routes.ts
│       │   │   └── readings/        # routes, controller, service, repository, validation, types, messages, tests
│       │   ├── utils/               # errors.ts, validation.ts, date.ts, database-errors.ts
│       │   ├── app.ts
│       │   ├── app.test.ts
│       │   └── server.ts
│       ├── tests/                   # Vitest setup (dedicated test database)
│       ├── drizzle/                 # Generated migrations live here
│       ├── Dockerfile
│       ├── drizzle.config.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── vitest.config.ts
├── docs/
│   └── README.md
├── .dockerignore
├── .env.example
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── docker-compose.yml
├── eslint.config.js
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.base.json
```

The application code is a modular monolith split into independently runnable frontend and backend
workspaces. There is no separate shared package yet; shared contracts can be introduced when the
domain model is designed.

## Prerequisites

- **Node.js** `^22.13.0` or `>=24.0.0`. Node.js 22 LTS is recommended and is used by the Docker images.
- **npm** `>=10`.
- **PostgreSQL** 16+ for local development without Docker.
- **Docker Desktop** (or Docker Engine with Compose v2) for the Docker workflow.
- No Bun installation is required.

## Install dependencies

From the repository root:

```bash
npm install
```

Dependencies for both workspaces are installed and hoisted by npm.

## Environment configuration

Both applications and Docker Compose use a single, git-ignored `.env` file at the repository root.
Create it from the example:

```bash
cp .env.example .env
```

Then update the values for your machine. The example contains placeholders only.

| Variable                    | Purpose                                                                 | Local default           |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`                  | Runtime mode (`development`, `test`, or `production`)                   | `development`           |
| `PORT`                      | Port used by the Express server when running locally                    | `5000`                  |
| `CLIENT_URL`                | Allowed browser origin for CORS                                         | `http://localhost:5173` |
| `DATABASE_URL`              | PostgreSQL connection string for local (non-Docker) development         | `postgresql://...`      |
| `TEST_DATABASE_URL`         | Dedicated test database for Vitest. The name **must** end with `_test`  | `postgresql://...`      |
| `JWT_SECRET`                | Secret used to sign JWTs. Required, minimum 32 characters               | —                       |
| `JWT_EXPIRES_IN`            | JWT and cookie lifetime, in `s`/`m`/`h`/`d` units                       | `1h`                    |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Rate-limit window for auth endpoints, in milliseconds                   | `900000` (15 minutes)   |
| `AUTH_RATE_LIMIT_MAX`       | Max auth requests per IP within the rate-limit window                   | `20`                    |
| `POSTGRES_DB`               | Database created by the Docker PostgreSQL service                       | `sweety`                |
| `POSTGRES_USER`             | Database user created by the Docker PostgreSQL service                  | `sweety`                |
| `POSTGRES_PASSWORD`         | Database password for Docker and local setup; change this placeholder   | `change_me`             |
| `POSTGRES_PORT`             | Host port mapped to PostgreSQL's container port `5432`                  | `5432`                  |
| `SERVER_PORT`               | Host port mapped to the API container's port `5000`                     | `5000`                  |
| `CLIENT_PORT`               | Host port mapped to the Vite container's port `5173`                    | `5173`                  |
| `VITE_API_PROXY_TARGET`     | Local Vite proxy target. Compose overrides it with `http://server:5000` | `http://localhost:5000` |

Notes:

- The server loads the root `.env` with `dotenv`. Variables injected by Docker Compose take precedence.
- Generate `JWT_SECRET` with `openssl rand -base64 48`. Never commit a real secret; the server fails
  fast at startup when `JWT_SECRET` is missing or shorter than 32 characters.
- `TEST_DATABASE_URL` is only used by Vitest. The test runner refuses to run unless the database name
  ends with `_test`, so destructive cleanup can never target the development database.
- Vite's built-in env-file loading is disabled because the server's `NODE_ENV=development` in the
  shared root file would otherwise force development bundles during `vite build`. The Vite config
  reads only `VITE_API_PROXY_TARGET` from the root file for its dev proxy; Docker Compose injects that
  value directly. No client runtime environment variables are needed.
- `.env` and all `.env.*` files except `.env.example` are ignored by Git and excluded from Docker
  build contexts.
- Keep `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` consistent. Passwords
  that contain URL-reserved characters must be URL-encoded when placed in `DATABASE_URL`.
- Docker Compose interpolates `POSTGRES_*` values into the backend's `DATABASE_URL`, using the Compose
  service hostname `postgres` and internal port `5432`. It also passes `JWT_SECRET` and
  `JWT_EXPIRES_IN` from the root `.env` into the server container; the server refuses to start when
  `JWT_SECRET` is missing or too short.

### Local PostgreSQL setup

If PostgreSQL is installed locally (for example with Homebrew), create a role and database that match
your `.env`:

```bash
# Start the local service if necessary (Homebrew example)
brew services start postgresql@18

# Create a development role and database. Replace the placeholder password.
psql -d postgres -c "CREATE ROLE sweety WITH LOGIN PASSWORD 'change_me';"
createdb --owner=sweety sweety

# Create a dedicated test role and database for Vitest.
psql -d postgres -c "CREATE ROLE sweety_test WITH LOGIN PASSWORD 'change_me';"
createdb --owner=sweety_test sweety_test
```

If a role or database already exists, skip its command. The default local connection strings are:

```text
postgresql://sweety:change_me@localhost:5432/sweety       # development
postgresql://sweety_test:change_me@localhost:5432/sweety_test   # tests
```

The API validates the environment with Zod at startup and exits with a readable message when required
variables are missing or malformed. It also checks the database connection before accepting HTTP
traffic, so local API startup requires a reachable PostgreSQL instance.

## Running locally

Start both applications with one command:

```bash
npm run dev
```

This uses `concurrently` and shuts both processes down together.

Start them independently when needed:

```bash
npm run dev:server   # Express API with tsx watch
npm run dev:client   # Vite dev server
```

Default URLs:

- Frontend: <http://localhost:5173>
- API health: <http://localhost:5000/api/health>
- Health through the Vite proxy: <http://localhost:5173/api/health>

The Vite dev server proxies `/api` requests to `VITE_API_PROXY_TARGET`, so browser API calls can use
relative URLs such as `/api/health`.

### Port conflicts

macOS AirPlay Receiver commonly listens on port `5000`. If the API cannot bind, set these in `.env`:

```dotenv
PORT=5001
VITE_API_PROXY_TARGET=http://localhost:5001
```

For Docker, change only the host mapping with `SERVER_PORT=5001`; the client still reaches the API
through the internal service name `server:5000`. Local PostgreSQL and another PostgreSQL instance can
also conflict on `5432`; use `POSTGRES_PORT=5433` for the Docker host mapping if needed.

## Scripts

### Root scripts

| Command                      | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `npm run dev`                | Run API and client concurrently                          |
| `npm run dev:client`         | Run only the Vite client                                 |
| `npm run dev:server`         | Run only the Express API in watch mode                   |
| `npm run build`              | Build both workspaces                                    |
| `npm run test`               | Run all test suites once                                 |
| `npm run test:watch`         | Run all test suites in watch mode                        |
| `npm run typecheck`          | Run TypeScript checks in both workspaces                 |
| `npm run lint`               | Run ESLint over the repository                           |
| `npm run lint:fix`           | Run ESLint and apply safe fixes                          |
| `npm run format`             | Format supported files with Prettier                     |
| `npm run format:check`       | Check formatting without changing files                  |
| `npm run db:generate`        | Generate a Drizzle migration from schema changes         |
| `npm run db:migrate`         | Apply pending Drizzle migrations                         |
| `npm run db:push`            | Push the schema directly to the database (development)   |
| `npm run db:studio`          | Open Drizzle Studio                                      |
| `npm run docker:up`          | Build and start the full Compose stack in the foreground |
| `npm run docker:up:detached` | Build and start the full Compose stack in the background |
| `npm run docker:down`        | Stop containers and network, preserving database data    |
| `npm run docker:logs`        | Follow logs from all Compose services                    |
| `npm run docker:ps`          | Show Compose service status                              |

### Application scripts

Client:

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start Vite with HMR                      |
| `npm run build`      | Type-check and create a production build |
| `npm run preview`    | Preview the production build             |
| `npm run test`       | Run Vitest once                          |
| `npm run test:watch` | Run Vitest in watch mode                 |
| `npm run typecheck`  | Type-check the client                    |

Server:

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Start Express with `tsx watch`             |
| `npm run build`      | Compile TypeScript to `dist/`              |
| `npm run start`      | Run the compiled server                    |
| `npm run test`       | Run Vitest and Supertest                   |
| `npm run test:watch` | Run Vitest in watch mode                   |
| `npm run typecheck`  | Type-check the server                      |
| `npm run db:*`       | Drizzle generate, migrate, push, or studio |

Run workspace scripts from the root with npm, for example:

```bash
npm run dev --workspace @sweety/client
npm run test --workspace @sweety/server
```

## API

### Health

```http
GET /api/health
```

Successful response:

```json
{
  "status": "ok",
  "message": "Sweety API is running"
}
```

### Authentication

| Method | Endpoint             | Auth required | Description                                  |
| ------ | -------------------- | ------------- | -------------------------------------------- |
| POST   | `/api/auth/register` | No            | Create an account and start a session        |
| POST   | `/api/auth/login`    | No            | Authenticate and start a session             |
| GET    | `/api/auth/me`       | Yes           | Return the authenticated user's safe profile |
| POST   | `/api/auth/logout`   | No            | Clear the session cookie (idempotent)        |

#### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Demo User",
  "email": "demo@example.com",
  "password": "SecurePassword123"
}
```

`201 Created` — returns a safe user (never a password hash) and sets the auth cookie:

```json
{
  "id": "6f1c2b52-9f2f-4f1e-9f9a-1a2b3c4d5e6f",
  "name": "Demo User",
  "email": "demo@example.com",
  "createdAt": "2026-11-12T00:00:00.000Z",
  "updatedAt": "2026-11-12T00:00:00.000Z"
}
```

Errors:

- `400` with `details` listing per-field validation errors (name required, valid email, password of
  at least 8 characters).
- `409` when the email is already registered (case-insensitive): "An account with this email already
  exists."

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "demo@example.com",
  "password": "SecurePassword123"
}
```

`200 OK` — same safe user shape as register, and sets the auth cookie.

Errors: `401` with the generic message "Invalid email or password." for both a wrong password and a
non-existent email, so account existence is never revealed.

#### Current user

```http
GET /api/auth/me
```

Requires a valid auth cookie. `200 OK` returns the safe user; `401` returns
"Authentication required." when the cookie is missing, invalid, or expired.

#### Logout

```http
POST /api/auth/logout
```

`200 OK` clears the auth cookie with the same options used to set it. It is safe to call while
already logged out.

### Blood glucose readings

All reading endpoints require authentication (HTTP 401 otherwise) and always operate on the
authenticated user's data; a user ID from the request body is never trusted.

| Method | Endpoint            | Description                                         |
| ------ | ------------------- | --------------------------------------------------- |
| POST   | `/api/readings`     | Create a reading                                    |
| GET    | `/api/readings`     | List the user's readings with optional date filters |
| GET    | `/api/readings/:id` | Retrieve one of the user's readings                 |
| PATCH  | `/api/readings/:id` | Update one of the user's readings                   |
| DELETE | `/api/readings/:id` | Delete one of the user's readings                   |

#### Reading data model

| Column         | Type                       | Constraints                                                          |
| -------------- | -------------------------- | -------------------------------------------------------------------- |
| `id`           | `uuid`                     | Primary key, PostgreSQL-generated                                    |
| `user_id`      | `uuid`                     | Foreign key to `users.id`, `ON DELETE CASCADE`                       |
| `reading_date` | `date` (date-only)         | Not null; stored as `YYYY-MM-DD` internally, API speaks `DD-MM-YYYY` |
| `slot`         | enum `reading_slot`        | `morning`, `after_breakfast`, `after_lunch`, `after_dinner`          |
| `value`        | `integer`                  | Not null; `CHECK (value BETWEEN 40 AND 600)` (mg/dl)                 |
| `created_at`   | `timestamp with time zone` | Not null, defaults to `now()`                                        |
| `updated_at`   | `timestamp with time zone` | Not null, defaults to `now()`                                        |

Database constraints:

- Unique index on `(user_id, reading_date, slot)` — one reading per slot per day per user.
- Regular index on `(user_id, reading_date)` for the daily/list queries.
- Check constraint on the value range as a second line of defense behind Zod validation.

#### Supported slots

| Slot value        | Label used in messages |
| ----------------- | ---------------------- |
| `morning`         | Morning (fasting)      |
| `after_breakfast` | After breakfast        |
| `after_lunch`     | After lunch            |
| `after_dinner`    | After dinner           |

#### Create a reading

```http
POST /api/readings
Content-Type: application/json
Cookie: sweety_access_token=...

{
  "readingDate": "12-11-2026",
  "slot": "morning",
  "value": 105
}
```

`201 Created` returns the reading:

```json
{
  "id": "0f8d4c7a-4f3e-4d8a-9d3e-6e2a1b7c9d01",
  "userId": "6f1c2b52-9f2f-4f1e-9f9a-1a2b3c4d5e6f",
  "readingDate": "12-11-2026",
  "slot": "morning",
  "value": 105,
  "createdAt": "2026-11-12T10:30:00.000Z",
  "updatedAt": "2026-11-12T10:30:00.000Z"
}
```

Validation errors return `400` with `details` of `{ path, message }` items. The fixed messages are:

- `Please enter a glucose value.` — value missing or not a number.
- `Value must be between 40 and 600 mg/dl.` — below 40, above 600, or not a whole number.
- `Date cannot be in the future.` — the calendar date is after today.
- `Please enter a valid date in DD-MM-YYYY format.` — wrong shape or not a real calendar date.
- `Slot must be one of morning, after_breakfast, after_lunch, or after_dinner.`

Conflict errors return `409`:

- `You already have a Morning (fasting) reading for this date.` (or `an After breakfast reading`,
  etc.) — duplicate slot for the same date.
- `You can add only 4 readings per day.` — a fifth reading for the same day.

#### List readings

```http
GET /api/readings                     # all readings, newest first
GET /api/readings?date=12-11-2026     # a single day
GET /api/readings?from=01-11-2026&to=10-11-2026
```

Rules:

- `date` cannot be combined with `from` or `to` (400).
- `from` must not be later than `to` (400).
- All filter dates must be valid calendar dates and may not be in the future (400).
- Results sort by `readingDate` descending, then slot order: morning, after_breakfast,
  after_lunch, after_dinner.

#### Update a reading

```http
PATCH /api/readings/:id
Content-Type: application/json

{ "value": 130 }
```

All fields are optional but at least one is required (`400` otherwise). The same validation rules
as creation apply to updated fields, and a change that would collide with another slot on the same
date returns `409`. Nonexistent or foreign-owned readings return `404` with
`Reading not found.` — foreign data is never revealed.

#### Delete a reading

```http
DELETE /api/readings/:id
```

`200 OK` with `{ "status": "ok", "message": "Reading deleted successfully." }`. Nonexistent or
foreign-owned readings return `404`.

#### Date and timezone handling

The API speaks **DD-MM-YYYY**: request bodies and query filters accept it, and every response
returns `readingDate` in that form. Internally the value is stored and compared as a PostgreSQL
`DATE` (`YYYY-MM-DD`), converted deterministically at the API boundary with pure string arithmetic —
it is never routed through a JavaScript timestamp, so no timezone can shift the calendar day.
"Today" for the future-date rule is determined in **Asia/Kolkata** (the assignment timezone
convention), so a reading entered after midnight UTC, for example, still belongs to the correct
local day.

### Blood glucose reports

All report endpoints require the authentication cookie and always operate on the authenticated
user's own readings — other users' data is excluded by the database query itself, never by
post-filtering. All report dates in requests and responses are **DD-MM-YYYY**. The project's
response convention is a bare JSON object (no `status: 'success'` wrapper).

Every report summary has the same shape:

```json
{
  "highest": 145,
  "lowest": 95,
  "average": 122.0,
  "totalReadings": 4
}
```

- `highest`/`lowest`/`average` are `null` (never `0`) when the period has no readings, so an empty
  report cannot be mistaken for recorded measurements.
- `average` is the mean of all **individual** readings in the period — never an average of daily
  averages — rounded to exactly one decimal place (`121.44 → 121.4`, `121.46 → 121.5`) and returned
  as a JSON number.
- Aggregates for period reports are computed in PostgreSQL (`MAX`, `MIN`, `AVG`, `COUNT` through
  Drizzle) over the `(user_id, reading_date)` index in a single query.

#### Daily report

```http
GET /api/reports/daily?date=12-11-2026
```

Returns the day's readings in slot order (morning, after_breakfast, after_lunch, after_dinner) plus
the summary. The `date` parameter is required and follows the same validation rules as readings:
real calendar date, not in the future.

```json
{
  "reportType": "daily",
  "date": "12-11-2026",
  "summary": { "highest": 145, "lowest": 95, "average": 122.0, "totalReadings": 4 },
  "readings": [
    { "id": "…", "readingDate": "12-11-2026", "slot": "morning", "value": 95 },
    { "id": "…", "readingDate": "12-11-2026", "slot": "after_breakfast", "value": 145 },
    { "id": "…", "readingDate": "12-11-2026", "slot": "after_lunch", "value": 130 },
    { "id": "…", "readingDate": "12-11-2026", "slot": "after_dinner", "value": 118 }
  ]
}
```

An empty day returns `200` with `summary: { highest: null, lowest: null, average: null,
totalReadings: 0 }` and `readings: []` — never a `404`.

#### Month-to-date report

```http
GET /api/reports/month-to-date?date=12-11-2026
```

Aggregates from the first day of the selected month through the selected date, both boundaries
inclusive. Readings after the selected date and readings from earlier months are excluded.

```json
{
  "reportType": "month-to-date",
  "period": { "startDate": "01-11-2026", "endDate": "12-11-2026" },
  "summary": { "highest": 180, "lowest": 85, "average": 121.5, "totalReadings": 24 }
}
```

#### Previous month report

```http
GET /api/reports/monthly
```

No query parameter. The period is the entire calendar month before the current date, determined in
**Asia/Kolkata**. January correctly resolves to December of the previous year, and leap-year
February (29 days) is handled by date arithmetic rather than hardcoded month lengths.

```json
{
  "reportType": "monthly",
  "period": { "startDate": "01-10-2026", "endDate": "31-10-2026" },
  "summary": { "highest": 190, "lowest": 78, "average": 119.4, "totalReadings": 96 }
}
```

#### Report errors

- Missing, malformed, impossible, or future `date` → `400` with
  `details: [{ "path": "date", "message": … }]`, using the same messages as the readings endpoints.
- Missing, invalid, or expired cookie → `401 { "status": "error", "message": "Authentication
required." }`.

Unknown routes return a JSON `404` response. The Express application is exported from `app.ts` and is
importable without starting a listener, which allows Supertest to exercise it directly. `server.ts`
owns database startup checks, HTTP listening, and graceful shutdown on `SIGINT`/`SIGTERM`.

## Authentication flow

1. **Register or login.** The server validates input with Zod (email is trimmed and lowercased),
   hashes passwords with `bcryptjs` (cost factor 12), and stores the user.
2. **Token issuance.** On success the server signs a minimal JWT (HS256, subject = user ID) using
   `JWT_SECRET` and sets it in the HTTP-only cookie `sweety_access_token`.
3. **Authenticated requests.** The browser automatically sends the cookie. The `requireAuth`
   middleware verifies the signature, expiration, and subject (it must be a UUID) and attaches
   `authenticatedUserId` to the request. The server never trusts a user ID from the request body.
4. **Current user.** `GET /api/auth/me` loads the user by the verified ID and returns the safe
   profile.
5. **Logout.** The server clears the cookie with matching options.

### Cookie behavior

The cookie `sweety_access_token` is set with:

- `httpOnly: true` — not readable by JavaScript.
- `sameSite: 'lax'` — sent on top-level navigations and same-site requests.
- `secure: true` in production only (plain HTTP is allowed during local development).
- `path: '/'` and a `maxAge` that always matches `JWT_EXPIRES_IN`, both when setting and clearing.

The frontend never stores tokens in `localStorage` or `sessionStorage`. All API calls are same-origin
relative `/api/...` requests (through the Vite dev proxy in development) with
`credentials: 'include'`, and CORS on the server is configured with `credentials: true` for the
allowed `CLIENT_URL`.

### Security decisions and limitations

- Passwords are hashed with bcrypt cost 12; plaintext passwords and password hashes are never
  returned by any endpoint.
- Login failures use a single generic message to avoid user enumeration.
- Duplicate registrations return `409`, which does reveal that an email exists on the register
  endpoint (an inherent trade-off of the UX requirement to tell users the email is taken).
- JWTs carry only `sub` (the user ID) plus the standard claims; they are verified with the configured
  algorithm and a UUID subject check.
- **CSRF:** HTTP-only cookies mitigate XSS token theft but do **not** by themselves eliminate CSRF.
  `SameSite=Lax` blocks most cross-site POST attacks from other origins, and the API currently
  accepts only JSON bodies, which browsers cannot submit cross-site with a simple form. Still,
  defenses such as a CSRF token, `Origin`/`Referer` checking, or `SameSite=Strict` should be
  considered before exposing state-changing endpoints to other origins or relaxing the JSON-only
  body requirement.
- There is no refresh-token rotation or revocation list; a stolen cookie remains valid until
  `JWT_EXPIRES_IN` elapses.

### Rate limiting

`POST /api/auth/register` and `POST /api/auth/login` are rate limited with `express-rate-limit`
(per-IP). Defaults are **20 requests per 15 minutes**, configurable through `AUTH_RATE_LIMIT_MAX`
and `AUTH_RATE_LIMIT_WINDOW_MS`. Exceeding the limit returns HTTP `429` with the standard error
shape:

```json
{
  "status": "error",
  "message": "Too many requests. Please try again later."
}
```

The limiter is applied only to these two endpoints — logout and `/me` are not throttled — and is
disabled while `NODE_ENV=test` so the integration tests stay deterministic. It keeps counters in
**process memory**, which is suitable for this single-instance deployment: limits are per instance
and reset on restart. A multi-instance production deployment would need a shared store (for example
Redis) for consistent limits, which is intentionally out of scope here.

## Database and Drizzle

- `apps/server/src/database/index.ts` creates the `pg` pool and Drizzle client.
- `apps/server/src/database/schema.ts` defines the `users` table:

| Column          | Type                       | Constraints                         |
| --------------- | -------------------------- | ----------------------------------- |
| `id`            | `uuid`                     | Primary key, PostgreSQL-generated   |
| `name`          | `varchar(120)`             | Not null                            |
| `email`         | `varchar(255)`             | Not null, unique case-insensitively |
| `password_hash` | `varchar(255)`             | Not null (bcrypt hash)              |
| `created_at`    | `timestamp with time zone` | Not null, defaults to `now()`       |
| `updated_at`    | `timestamp with time zone` | Not null, defaults to `now()`       |

Case-insensitive uniqueness is enforced in the database with
`CREATE UNIQUE INDEX users_email_unique_index ON users (lower(email))`, so `Demo@Example.com` and
`demo@example.com` cannot both register. The schema is ready for a future `readings` table with a
foreign key to `users`.

- `apps/server/drizzle.config.ts` reads `DATABASE_URL` from the root `.env`.
- Generated migrations belong in `apps/server/drizzle/` and are committed to the repository.

Typical workflow after the schema is changed:

```bash
npm run db:generate   # create SQL migration from schema.ts
npm run db:migrate    # apply it to the database in DATABASE_URL
npm run db:studio     # inspect data in Drizzle Studio
```

`npm run db:push` is available for rapid development but should not replace reviewed migrations in
shared environments.

Vitest applies the committed migrations to `TEST_DATABASE_URL` in its global setup before any test
runs, so the test database always matches the schema in the repository.

To run Drizzle commands against the Docker database from the host, point `DATABASE_URL` at the mapped
host port (`localhost:5433` if you changed `POSTGRES_PORT`) using the Compose credentials.

## Docker development

Docker Compose runs the full stack with hot reload:

| Service    | Build / image            | Host port                | Internal address |
| ---------- | ------------------------ | ------------------------ | ---------------- |
| `client`   | `apps/client/Dockerfile` | `${CLIENT_PORT:-5173}`   | `client:5173`    |
| `server`   | `apps/server/Dockerfile` | `${SERVER_PORT:-5000}`   | `server:5000`    |
| `postgres` | `postgres:17-alpine`     | `${POSTGRES_PORT:-5432}` | `postgres:5432`  |

Start the stack:

```bash
# From the repository root, after creating .env
docker compose up --build
```

Or in the background:

```bash
docker compose up -d
docker compose ps
docker compose logs -f
```

Open:

- Frontend: <http://localhost:5173>
- Backend health: <http://localhost:5000/api/health>
- Browser-facing proxied health: <http://localhost:5173/api/health>
- PostgreSQL from host tools: `localhost:5432` (unless overridden by `POSTGRES_PORT`)

The client container's Vite server binds to `0.0.0.0` and proxies `/api` to `http://server:5000` over
the dedicated `sweety-network` bridge network. The backend reaches PostgreSQL at
`postgres:5432`; its `DATABASE_URL` is constructed by Compose and overrides any local value.

### Health checks and startup order

- PostgreSQL uses `pg_isready` and is marked healthy before the backend starts.
- The backend waits for PostgreSQL's health check and exposes a health check against `/api/health`.
- The frontend starts after the backend is healthy.
- `docker compose ps` shows the health state of all services.

### Hot reload and dependencies

Only each application's `src/` directory is bind-mounted:

- Server changes restart `tsx watch`.
- Client changes refresh through Vite HMR.
- `node_modules` is **not** bind-mounted; dependencies installed inside the image are preserved.
- Rebuild after changing `package.json`, `package-lock.json`, a Dockerfile, `index.html`, Vite config,
  or root TypeScript config:

```bash
docker compose up -d --build
```

Application containers run as the non-root `node` user (UID 1000). The official PostgreSQL image
manages its own internal user. `.env` files and secrets are excluded from the build context by
`.dockerignore`.

### Stop, reset, and persistence

```bash
docker compose down
```

This stops and removes containers and the network, but **keeps** the named volume
`sweety_postgres_data`. PostgreSQL data survives container restarts and `docker compose down`, and is
reused on the next `docker compose up`.

```bash
docker compose down -v
```

> **Warning:** `-v` / `--volumes` also removes the named database volume. All data in the Docker
> PostgreSQL database is permanently deleted. No project script runs this automatically.

Use `down -v` only when you intentionally want a clean database. To verify persistence manually:
write data, run `docker compose down`, run `docker compose up -d` again, and query the data. The volume
can be inspected with:

```bash
docker volume inspect sweety_postgres_data
```

### Docker troubleshooting

- **Port 5000 already in use:** macOS AirPlay commonly uses it. Set `SERVER_PORT=5001` in `.env`; the
  container still listens on 5000 and the Vite proxy is unaffected.
- **Port 5432 already in use:** a local PostgreSQL instance is running. Set `POSTGRES_PORT=5433` in
  `.env`; container-to-container connections still use `postgres:5432`.
- **Stale dependencies after a lockfile change:** rebuild with `docker compose up -d --build`.
- **View a failing service:** `docker compose logs <client|server|postgres>`.
- **Reset everything including data:** `docker compose down -v` (destructive; see warning above).

## Quality checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The current tests cover:

- The Express health endpoint with Supertest.
- The placeholder page with React Testing Library.
- The full authentication flow against the real HTTP app and the dedicated PostgreSQL test database:
  registration (including password-hash verification in the database), case-insensitive duplicate
  emails, validation errors, login (success, wrong password, non-existent email), `/me` with valid,
  missing, invalid, and expired tokens, and logout cookie clearing.
- The blood glucose readings CRUD flow against the real HTTP app and test database: authentication
  on every endpoint, creation validation (range, decimals, slots, calendar dates, future dates,
  duplicates, daily limit), multi-user ownership, listing with date/range filters and sorting,
  retrieval, updates (partial, conflicts, ownership), deletion, and the database check/cascade
  constraints.

Test files run sequentially (`fileParallelism: false`) because all suites share one PostgreSQL test
database; parallel files would otherwise truncate each other's fixtures.

## Testing setup

Backend tests require a dedicated PostgreSQL test database configured through `TEST_DATABASE_URL`.
The database name must end with `_test`; the runner throws an error otherwise, so destructive test
cleanup (`TRUNCATE TABLE users`) can never target the development database.

```bash
# Configure in .env, then run:
npm test --workspace @sweety/server
```

Vitest's global setup applies the committed Drizzle migrations to the test database before tests run.
Tests exercise the real Express application and database — they are not mocked at the HTTP or data
layers.

## Design system

The client has a warm, calm health-tech identity: **cream background, dark olive typography**.

| Token        | Value     | Use                                                                          |
| ------------ | --------- | ---------------------------------------------------------------------------- |
| `cream`      | `#F6F3E9` | Page background                                                              |
| `surface`    | `#FFFEF8` | Cards, inputs                                                                |
| `ink`        | `#343D27` | Primary text, values                                                         |
| `ink-soft`   | `#6A7058` | Secondary text (darkened from the original `#777C68` to pass 4.5:1 on cream) |
| `olive`      | `#596747` | Interactive accents, chart bars                                              |
| `olive-dark` | `#343F2B` | Primary buttons, active nav, brand                                           |
| `sage`       | `#DCE3D3` | Filled/selected states                                                       |
| `beige`      | `#EAE4D4` | Empty-slot surfaces                                                          |
| `line`       | `#E4E0D3` | 1px borders                                                                  |
| `terracotta` | `#C98568` | Destructive actions and small accents only                                   |

Tokens live in `@theme` in `apps/client/src/index.css` (Tailwind v4 CSS-first configuration) and are
consumed as standard Tailwind colour utilities (`bg-cream`, `text-ink`, `border-line`, …).

Typography is **Instrument Sans** (Google Fonts, one family, 400–700). Headings use tight tracking;
every numeric value — readings, averages, counts — uses tabular numerals (`tabular-nums`) so
columns and comparisons stay aligned. Rules of thumb: 1px borders for elevation (soft shadows only
on the modal layer), 12–16px radii, no gradient text, no glass effects, no decorative illustrations.

Motion is `motion/react` (the modern Framer Motion package), used only where CSS transitions are
insufficient: page entrance, dialog enter/exit (200 ms ease-out, scale 0.97), report-tab crossfade,
and one stagger-free dashboard entrance. Hover/press feedback is plain CSS. `prefers-reduced-motion`
is honoured both globally (CSS) and in Motion (`useReducedMotion`).

## Phase scope

### Phase 0 (foundation)

Included:

- npm workspaces and shared strict TypeScript configuration
- React + TypeScript + Vite + Tailwind + React Router frontend foundation
- Express + TypeScript backend foundation with security headers, CORS, and JSON parsing
- Zod environment validation
- PostgreSQL connection and Drizzle client initialization
- `/api/health`, graceful shutdown, and backend tests
- Docker Compose development environment with persistence and health checks
- Documentation and code-quality tooling

### Phase 1 (authentication and user foundation)

Included:

- `users` table with a case-insensitive unique email index and a committed Drizzle migration
- Zod-validated registration, login, current-user, and logout endpoints
- bcrypt password hashing (cost 12) and HS256 JWT signing
- HTTP-only cookie token transport with `requireAuth` middleware
- In-memory rate limiting on register and login endpoints
- Typed frontend auth API client (`registerUser`, `loginUser`, `logoutUser`, `getCurrentUser`)
- Integration tests against a dedicated `_test` database

### Phase 1 implementation notes

- **Token transport.** JWTs live only in the HTTP-only `sweety_access_token` cookie
  (`sameSite: 'lax'`, `secure` in production, `maxAge` always matching `JWT_EXPIRES_IN`). They are
  never returned in JSON bodies and never stored in web storage. Logout clears the cookie with the
  same identity/security attributes minus `maxAge`.
- **JWT shape.** HS256 only (signing and verification), payload limited to `sub` (user UUID),
  verified with `JWT_SECRET` (Zod-enforced, ≥32 characters). The middleware rejects missing,
  invalid, expired, or foreign-algorithm tokens with a single generic 401.
- **Passwords.** bcrypt cost 12. Plaintext and hashes never appear in any API response.
- **User enumeration.** Login returns one generic message for wrong password and unknown email.
  Registration returns `409` for duplicates, which inherently reveals that an email exists.
- **Rate limiting.** Register and login are limited per IP (default 20 requests / 15 minutes,
  configurable via `AUTH_RATE_LIMIT_*`). Counters are in process memory — suitable for this
  single-instance deployment, not for multi-instance production. The limiter is skipped while
  `NODE_ENV=test` so integration tests stay deterministic; its 429 behavior is covered by dedicated
  tests against the exported factory.
- **Test safety.** Vitest requires `TEST_DATABASE_URL` whose database name ends with `_test`;
  destructive cleanup refuses to run against anything else. Global setup applies the committed
  migrations to the test database before any test runs.
- **Known limitations.** No CSRF token (mitigated by `SameSite=Lax` and JSON-only bodies, still a
  documented gap), no refresh-token rotation or revocation, and no login/register UI yet — only the
  typed API client.

### Phase 2 (blood glucose readings)

Included:

- `readings` table (date-only reading date, slot enum, value check constraint, unique per
  user/date/slot, cascade delete) with a committed Drizzle migration
- Authenticated CRUD endpoints for readings with ownership enforced on every query
- Zod validation with friendly fixed messages, including date-only and Asia/Kolkata "today" logic
- Typed frontend readings API client (`createReading`, `listReadings`, `getReading`,
  `updateReading`, `deleteReading`)
- Comprehensive integration tests for CRUD, ownership, filters, sorting, and constraints

Intentionally not included:

- Login/register UI screens or dashboard/charts UI (only the typed API clients exist)
- Daily/monthly reports or report calculations
- Doctor roles, reminders, notifications
- Redis, BullMQ, background jobs, refresh-token rotation, or Docker production deployment
- CI/CD pipelines
- Pagination (no existing convention requires it yet)

Those belong to later phases.

### Phase 2 implementation notes

Phase 2 delivered the authenticated blood glucose readings CRUD (commit `fe4c183`):

- **Date-only semantics.** `readingDate` is a PostgreSQL `DATE` stored and sorted as `YYYY-MM-DD`
  internally, while the API accepts and returns **DD-MM-YYYY** (changed per product decision after
  Phase 2; conversion is pure string arithmetic at the API boundary). No JavaScript timestamp
  conversion touches it, so no timezone can shift the calendar day. Calendar validity (e.g.
  30-02-2026 is rejected) is verified with a UTC round-trip check, not `new Date(string)`.
- **Timezone.** "Today" for the future-date rule is computed in **Asia/Kolkata** via
  `Intl.DateTimeFormat`. `APP_TIMEZONE` in `apps/server/src/utils/date.ts` is the single place to
  change it.
- **Ownership.** The user ID always comes from the verified JWT (`authenticatedUserId`); request
  bodies cannot set it. Every read, update, and delete filters by both reading id and user id, so
  foreign readings are indistinguishable from missing ones (`404 Reading not found.`).
- **Database-backed rules.** One reading per user/date/slot (unique index), 40–600 mg/dl (check
  constraint plus Zod), at most four readings per day (service count check, message
  `You can add only 4 readings per day.`). Unique violations map to friendly slot-label conflicts
  such as `You already have a Morning (fasting) reading for this date.`; no raw database errors
  leak.
- **Listing.** Optional `date` (exclusive of `from`/`to`) or `from`/`to` range, no future dates,
  sorted by `readingDate` descending then slot order (morning, after_breakfast, after_lunch,
  after_dinner).
- **Test isolation.** All suites share one `_test` database, so test files run sequentially
  (`fileParallelism: false`) and cleanup truncates `users CASCADE`, which clears readings too.
- **Date format.** The assignment's examples used `YYYY-MM-DD`; the product decision afterwards
  switched the API surface to **DD-MM-YYYY** (storage stays `YYYY-MM-DD`).
- **Known limitations.** The daily-limit check is count-then-insert, so two simultaneous creates
  for the same day could theoretically land a fifth reading (the unique index still prevents
  duplicate slots); readings queries are not paginated yet; deleting a user cascades their
  readings.

### Phase 3 (report generation and analytics)

Included:

- `/api/reports/daily?date=…`, `/api/reports/month-to-date?date=…`, and `/api/reports/monthly`
  endpoints, all behind the existing `requireAuth` middleware
- Daily report with individual readings in slot order plus highest/lowest/average/count
- Month-to-date and previous-month reports aggregated in PostgreSQL (`MAX`/`MIN`/`AVG`/`COUNT`
  through Drizzle) over the `(user_id, reading_date)` index
- Averages rounded to exactly one decimal place and returned as JSON numbers; `null` (not `0`)
  aggregates for empty periods
- Injectable pure date-range helpers (`monthToDateRange`, `previousMonthRange`) unit-tested against
  reference dates, including January → previous-year December and leap-year February
- Typed frontend API client (`reportsApi.ts`) and report types (`types/report.ts`) for the Phase 4
  dashboard — no reporting UI yet
- Integration tests for all three endpoints (authentication, validation, boundaries, known-value
  aggregation, rounding, two-user isolation)

Not included (deferred to Phase 4 or later): dashboard UI, charts, doctor accounts, exports,
email/notifications, caching layers, scheduled reports.

### Phase 3 implementation notes

Phase 3 delivered the reporting module (routes → controller → service → repository → PostgreSQL,
mirroring the readings module):

- **Architecture.** `apps/server/src/modules/reports/` with `reports.routes.ts` (mounted at
  `/api/reports`), `reports.controller.ts` (thin: validate query, call service, return JSON),
  `reports.service.ts` (date-range resolution, empty handling, rounding, DTO conversion),
  `reports.repository.ts` (single indexed SQL aggregate), and `reports.types.ts`. The daily report
  reuses `listReadings` from the readings repository — one query already sorted by slot order — and
  computes its summary from the same rows, so details and aggregates can never disagree.
- **Date ranges.** `monthToDateRange(reference)` is first-of-month through the reference date; both
  boundaries inclusive. `previousMonthRange(reference)` uses `Date.UTC` arithmetic — rolling
  January back to December of the previous year and taking day 0 of the following month as the last
  day — so no month length is hardcoded and leap years are correct. Both are pure functions of an
  ISO reference date and are unit-tested with injected reference dates (`2026-01-15` → December
  2025, `2024-03-10` → 29-day February). `/api/reports/monthly` resolves the reference with
  `todayInAppTimezone()` (Asia/Kolkata); integration tests seed the previous month dynamically from
  the same helper, so they do not depend on the machine's date.
- **Aggregation.** Period reports run one query per report with SQL `MAX`, `MIN`, `AVG`, and
  `COUNT(*)::int`, filtered by `user_id` and an inclusive date range — never fetch-and-filter in
  JavaScript. PostgreSQL `AVG` over integers returns a numeric, which arrives as a string; it is
  converted with `Number()` and rounded with `Math.round(value * 10) / 10`.
- **Empty reports.** Every endpoint returns `200` with `null` aggregates and `totalReadings: 0`
  (daily additionally returns `readings: []`). Zero is never used for highest/lowest/average, so an
  empty report cannot imply a recorded measurement.
- **Data format.** Report dates follow the project's DD-MM-YYYY API convention (the assignment
  examples used YYYY-MM-DD; the response shape is a bare object without a `status: 'success'`
  wrapper, matching the project's conventions).
- **Validation reuse.** Reports import the same `dateOnlySchema` the readings endpoints use, so
  date rules and messages are identical across modules.
- **Isolation.** The user ID always comes from the verified JWT; both the daily listing and the SQL
  aggregate filter by `user_id`. Two-user integration tests verify that foreign readings never
  appear in any report.
- **Known limitations.** No caching or materialized views (each report is one indexed query);
  `/api/reports/monthly` has no parameter to request a specific month (previous month only, per
  the assignment); averages are rounded for display — unrounded means are never persisted.

### Phase 4 (frontend implementation and visual design)

Included:

- Cookie-session authentication screens (login, registration with confirmation) using the existing
  auth API — no tokens in web storage
- Authenticated route protection (`RequireAuth` / `GuestRoute`) with a loading state while the
  session is resolved
- Dashboard: time-aware greeting, the four-slot daily rhythm (the day's readings _are_ the daily
  summary, with one-tap add on empty slots and edit on filled ones), month-to-date and
  previous-month overview, recent readings, add/edit/delete with confirmation
- Readings page: full history grouped by date, optional single-date filter, add/edit/delete
- Reports page: daily / month-to-date / previous-month tabs, date pickers, summary statistics and
  bar charts built from actual recorded readings only (no interpolation, no fabricated values, no
  diagnostic range colouring)
- Design system (cream/olive tokens, Instrument Sans, shared UI kit), responsive layouts, keyboard
  and screen-reader affordances, `prefers-reduced-motion` support
- Client unit tests for routing/redirects, date conversion, and the reading form

Not included: doctor accounts, exports, notifications, diagnostic interpretations, pagination
(the reading list is naturally small; the API sorts server-side).

### Phase 4 implementation notes

Phase 4 delivered the React frontend (`apps/client`):

- **Architecture.** `context/auth.ts` (session context, `useAuth`) + `AuthContext.tsx`
  (`AuthProvider`, `RequireAuth`, `GuestRoute`), `components/layout` (app shell, auth layout),
  `components/ui` (Button, Field/Input, Dialog, Card, StatusNote, authored SVG icons),
  `components/readings` (form dialog, grouped list, shared add/edit/delete dialog state),
  `components/reports` + `components/charts`, `lib` (date, slots, chart, status-note helpers),
  and six pages (public landing, auth, dashboard, readings, reports) wired through React Router
  — the dashboard lives at `/today`, guests land on `/`.
- **Session.** `AuthProvider` resolves the session on load with `GET /api/auth/me` (401 →
  unauthenticated). Login/register POST to the existing endpoints; the HTTP-only cookie remains
  the only credential anywhere.
- **Date format.** The client speaks the API's DD-MM-YYYY: HTML date inputs (YYYY-MM-DD) are
  converted in `lib/date.ts`, and "today" is computed in Asia/Kolkata so the client never offers a
  date the backend would reject as future.
- **Data honesty.** Charts draw only recorded readings (per-day means for period reports, labelled
  as such); empty reports show `—`, never `0`; no reference-range colouring or medical claims — the
  API numbers are presented as recorded.
- **Server errors.** API `details` arrays map onto form fields by path (`readingDate`, `slot`,
  `value`), and 409 messages (duplicate slot, four-per-day limit) surface verbatim in the form.
- **Test data note.** Verification runs create and then delete their own users; the dev database is
  left as found.

## Assumptions

- npm is used instead of Bun because the Docker addendum explicitly required Node.js and npm.
- The repository root is the project root; there is no additional nested project directory.
- The official `postgres:17-alpine` image is used in Compose, while the local setup was validated with
  PostgreSQL 18.
- `postgres` is the Compose service hostname; `localhost` is used outside Compose.
- The API refuses to start when PostgreSQL is unreachable. The health endpoint itself does not query
  the database; a successful startup means the initial connection check passed.
- Dockerfiles target development (Vite dev server and `tsx watch`), not a production web server/CDN setup.
- The local `.env` on the development machine may use alternate host ports when system services already
  occupy `5000` or `5432`; these overrides do not change container-internal ports.
- Vite's env-file loader is disabled to isolate client builds from the server's `NODE_ENV`. No client
  runtime environment variables are required; future client-specific `VITE_*` configuration can use
  an app-scoped env file if needed.
- Authentication cookies are only `secure` in production. Local development over plain HTTP is
  intentional; a production deployment must serve the API over HTTPS.
- The application timezone is Asia/Kolkata: "today" for date-only logic (the future-date rule and
  the previous-month report period) is computed with `Intl.DateTimeFormat` in that zone. Date values
  are stored and compared as `YYYY-MM-DD` internally, while the API surface speaks DD-MM-YYYY; dates
  are never converted through timestamps. If the assignment's target audience changes,
  `APP_TIMEZONE` in `apps/server/src/utils/date.ts` is the single place to adjust.
