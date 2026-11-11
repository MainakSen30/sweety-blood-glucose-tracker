# Sweety documentation

The primary setup, environment, API, testing, and Docker instructions live in the
[root README](../README.md).

## Phase 0 notes

This phase establishes the foundation only:

- **Architecture:** npm-workspace monorepo with a React client and an Express server. The backend is
  organized as a modular monolith; feature modules will live under `apps/server/src/modules/`.
- **Runtime boundary:** the browser talks to Vite on port 5173. Vite proxies `/api` to Express on port 5000. Express talks to PostgreSQL at `postgres:5432` inside Docker or `localhost:5432` outside it.
- **Database:** Drizzle ORM is configured with an intentionally empty schema. No migrations or
  application tables exist yet; schema design is deferred to the architecture phase.
- **Configuration:** environment values are validated once at server startup with Zod. Invalid or
  missing values fail fast with an actionable error.
- **Docker:** development-oriented images use Node.js 22 Alpine, run application processes as the
  non-root `node` user, and rely on Compose health checks for startup ordering. PostgreSQL data is
  stored in the named volume `sweety_postgres_data`.

No authentication, glucose-reading CRUD, reporting logic, or charts are part of Phase 0.
