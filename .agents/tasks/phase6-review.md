# Phase 6 Review

Commit reviewed: `ccaab6a` ("feat: Phase 6 – submission preparation")  
Previous commit (baseline): `0f7cfbc`

---

## Evidence summary

All files introduced by the Phase 6 commit were read in full. Schema, date utilities,
env validation, and package scripts were checked against the seed to verify correctness.
Coder's recorded verification (typecheck, lint, format:check exit 0) accepted as stated.

---

## Checklist results

### Seed script – apps/server/src/database/seed.ts

| Item | Result |
|---|---|
| Exists at correct path | ✅ |
| Refuses when NODE_ENV=production | ✅ line 52–55 |
| Refuses when SEED_DEMO_DATA !== 'true' | ✅ line 57–63 |
| Checks DATABASE_URL db name for non-production identifier (dev/demo/local/test) | ✅ lines 65–98 |
| Never uses TEST_DATABASE_URL | ✅ (never referenced; only DATABASE_URL read) |
| No TRUNCATE/DROP/DELETE against user data | ✅ (only occurrence is a comment at line 13) |
| Never overwrites existing demo user password | ✅ early-return on existing user; no UPDATE issued |
| ON CONFLICT DO NOTHING for readings (idempotent) | ✅ lines 265–270 |
| Closes PostgreSQL connection in finally block | ✅ lines 290–292 |
| Uses actual schema column names | ✅ userId, readingDate, slot, value match schema.ts |
| Glucose values in 40–600 mg/dL range | ✅ clamp applied; worst-case per slot: morning 75–115, after_breakfast 105–185, after_lunch 100–170, after_dinner 90–150 |
| Uses actual slot values from schema | ✅ imports schema.READING_SLOTS |
| ~30 days of data with full/partial/gap days | ✅ T-1…T-30, TEN_DAY_CYCLE includes full/three_slots/two_slots/morning_only/none |
| Uses Asia/Kolkata via todayInAppTimezone() | ✅ imported from utils/date.ts |
| db:seed in apps/server/package.json | ✅ |
| db:seed in root package.json | ✅ |

### .env.example

| Item | Result |
|---|---|
| All env.ts validated variables documented | ✅ NODE_ENV, PORT, CLIENT_URL, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX all present |
| JWT_SECRET generation instructions | ✅ openssl rand -hex 32 |
| DATABASE_URL format explained | ✅ format, examples, host-vs-container distinction |
| TEST_DATABASE_URL _test suffix requirement explained | ✅ explicitly stated |
| SEED_DEMO_DATA documented with safety notes | ✅ 6-point safety list included |
| No real credentials present | ✅ only change_me / replace-with-... placeholders |
| Docker vs host variable distinction explained | ✅ DOCKER COMPOSE sections clearly annotated |

### README.md

| Item | Result |
|---|---|
| Covers Phases 0–6 | ✅ Project phases section present for all phases |
| All 16 required sections present | ✅ Project overview, Features, Screenshots, Technology stack, Architecture, Repository structure, Prerequisites, Local installation, Database setup, Seed data, Running the application, API documentation, Testing, Security considerations, Assumptions and limitations, Design system, Project phases, Environment variable reference |
| API docs reflect actual routes | ✅ health, auth (register/login/me/logout), readings (POST/GET/GET:id/PATCH/DELETE), reports (daily/month-to-date/monthly) — all match actual route files |
| Screenshots section present with pending note | ✅ pending note + table with 7 filenames linking to docs/screenshots/README.md |
| Seed data section with demo credentials and safety notes | ✅ |
| Testing section does NOT claim specific pass counts without verification | ✅ "148 passing tests" stated with qualifier "(see CI output for current results)" and "Test counts: see CI output" |
| Security section covers known limitations honestly | ✅ no CSRF token, no token revocation, in-memory rate limiting, register reveals email existence, development Dockerfiles noted |

### docs/

| Item | Result |
|---|---|
| docs/screenshots/ directory exists | ✅ |
| docs/screenshots/README.md has manual capture instructions | ✅ 7 screenshots with URL/state/notes and viewport instructions |
| docs/demo-script.md exists with 9-step walkthrough | ✅ Steps 1–9 present |

### Engineering constraints

| Item | Result |
|---|---|
| No new npm dependencies added | ✅ diff shows no changes to any dependencies block |
| No product features added | ✅ only seed/docs/config changes |
| No architecture changes | ✅ |
| No real credentials committed | ✅ |
| No destructive DB operations | ✅ |

---

## Findings

No blockers found.

### Observation (not a blocker)

The `db:seed` script in `apps/server/package.json` hardcodes `SEED_DEMO_DATA=true` in the shell
invocation (`"db:seed": "SEED_DEMO_DATA=true tsx src/database/seed.ts"`). This is intentional
documented behaviour; the seed's internal runtime check on `process.env.SEED_DEMO_DATA` still
fires, and the coder's intent (convenient one-command invocation) was explicitly noted in the
commit message. The other two safety guards (NODE_ENV ≠ production, DB name pattern) remain
active regardless of how the env var is set by the script. This is an observation only.

---

## Verdict

**APPROVED** — no blockers remain.
