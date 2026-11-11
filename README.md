# Sweety – Blood Glucose Tracker

Sweety is a full-stack web application that will let a diabetes patient record up to four blood
glucose readings per day and review daily and monthly reports.

This repository currently contains **Phase 0: project foundation** only. It provides the monorepo,
tooling, configuration, API health endpoint, PostgreSQL/Drizzle connectivity, tests, and Docker-based
development environment. Application features, authentication, tables, and reports are intentionally
not implemented yet.

## Tech stack

| Area         | Technology                                                           |
| ------------ | -------------------------------------------------------------------- |
| Frontend     | React 19, TypeScript 5.9, Vite 8, React Router 7, Tailwind CSS 4     |
| Backend      | Node.js 22, Express 5, TypeScript 5.9, Zod 4                         |
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
│   │   │   ├── services/            # Placeholder for future API clients
│   │   │   ├── types/               # Placeholder for future client types
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
│       │   ├── middleware/          # Placeholder for future middleware
│       │   ├── modules/
│       │   │   └── health/health.routes.ts
│       │   ├── utils/               # Placeholder for future utilities
│       │   ├── app.ts
│       │   ├── app.test.ts
│       │   └── server.ts
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

| Variable                | Purpose                                                                 | Local default           |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`              | Runtime mode (`development`, `test`, or `production`)                   | `development`           |
| `PORT`                  | Port used by the Express server when running locally                    | `5000`                  |
| `CLIENT_URL`            | Allowed browser origin for CORS                                         | `http://localhost:5173` |
| `DATABASE_URL`          | PostgreSQL connection string for local (non-Docker) development         | `postgresql://...`      |
| `POSTGRES_DB`           | Database created by the Docker PostgreSQL service                       | `sweety`                |
| `POSTGRES_USER`         | Database user created by the Docker PostgreSQL service                  | `sweety`                |
| `POSTGRES_PASSWORD`     | Database password for Docker and local setup; change this placeholder   | `change_me`             |
| `POSTGRES_PORT`         | Host port mapped to PostgreSQL's container port `5432`                  | `5432`                  |
| `SERVER_PORT`           | Host port mapped to the API container's port `5000`                     | `5000`                  |
| `CLIENT_PORT`           | Host port mapped to the Vite container's port `5173`                    | `5173`                  |
| `VITE_API_PROXY_TARGET` | Local Vite proxy target. Compose overrides it with `http://server:5000` | `http://localhost:5000` |

Notes:

- The server loads the root `.env` with `dotenv`. Variables injected by Docker Compose take precedence.
- Vite's built-in env-file loading is disabled because the server's `NODE_ENV=development` in the
  shared root file would otherwise force development bundles during `vite build`. The Vite config
  reads only `VITE_API_PROXY_TARGET` from the root file for its dev proxy; Docker Compose injects that
  value directly. No client runtime environment variables are needed in Phase 0.
- `.env` and all `.env.*` files except `.env.example` are ignored by Git and excluded from Docker
  build contexts.
- Keep `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` consistent. Passwords
  that contain URL-reserved characters must be URL-encoded when placed in `DATABASE_URL`.
- Docker Compose interpolates `POSTGRES_*` values into the backend's `DATABASE_URL`, using the Compose
  service hostname `postgres` and internal port `5432`.

### Local PostgreSQL setup

If PostgreSQL is installed locally (for example with Homebrew), create a role and database that match
your `.env`:

```bash
# Start the local service if necessary (Homebrew example)
brew services start postgresql@18

# Create a development role and database. Replace the placeholder password.
psql -d postgres -c "CREATE ROLE sweety WITH LOGIN PASSWORD 'change_me';"
createdb --owner=sweety sweety
```

If the role or database already exists, skip those commands. The default local connection string is:

```text
postgresql://sweety:change_me@localhost:5432/sweety
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

Phase 0 exposes one endpoint:

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

Unknown routes return a JSON `404` response. The Express application is exported from `app.ts` and is
importable without starting a listener, which allows Supertest to exercise it directly. `server.ts`
owns database startup checks, HTTP listening, and graceful shutdown on `SIGINT`/`SIGTERM`.

## Database and Drizzle

- `apps/server/src/database/index.ts` creates the `pg` pool and Drizzle client.
- `apps/server/src/database/schema.ts` is intentionally empty; no tables exist in Phase 0.
- `apps/server/drizzle.config.ts` reads `DATABASE_URL` from the root `.env`.
- Generated migrations belong in `apps/server/drizzle/`.

Typical workflow after the schema is defined:

```bash
npm run db:generate   # create SQL migration from schema.ts
npm run db:migrate    # apply it to the database in DATABASE_URL
npm run db:studio     # inspect data in Drizzle Studio
```

`npm run db:push` is available for rapid development but should not replace reviewed migrations in
shared environments. Running `db:generate` with the current empty schema reports no schema changes and
creates no tables.

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

The current tests cover the Express health endpoint with Supertest and the placeholder page with React
Testing Library. There are no feature tests because no features are implemented in Phase 0.

## Phase 0 scope

Included:

- npm workspaces and shared strict TypeScript configuration
- React + TypeScript + Vite + Tailwind + React Router frontend foundation
- Express + TypeScript backend foundation with security headers, CORS, and JSON parsing
- Zod environment validation
- PostgreSQL connection and Drizzle client initialization
- `/api/health`, graceful shutdown, and backend tests
- Docker Compose development environment with persistence and health checks
- Documentation and code-quality tooling

Intentionally not included:

- Registration, login, JWT, passwords, or doctor roles
- User or glucose-reading tables
- Reading CRUD
- Daily/monthly report calculations
- Charts or dashboards
- Redis, Kafka, background jobs, or Docker production deployment
- CI/CD pipelines

Those belong to later phases.

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
- Vite's env-file loader is disabled to isolate client builds from the server's `NODE_ENV`. Phase 0
  requires no client runtime environment variables; future client-specific `VITE_*` configuration can
  use an app-scoped env file if needed.
