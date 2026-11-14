# Phase 13.1 — Dedicated Doctor Panel & Role-Based Frontend Experience

Implementation date: 14 November 2026

## 1. Existing architecture discovered

- One React 19 + Vite single-page application under `apps/client`, using React Router 7 and Tailwind CSS 4.
- A single authenticated shell, `components/layout/AppLayout.tsx`, rendered both patient and doctor pages.
- Authentication state lives in `context/AuthContext.tsx`; the HTTP-only cookie is the session and
  `GET /api/auth/me` resolves the user. Roles come from the server as `SafeUser.role` (`patient` or
  `doctor`); nothing is read from `localStorage`, URL parameters, or client-supplied state.
- `RequireAuth` handles the loading state and redirects unauthenticated visitors to `/login`.
  `RequireRole` redirects a signed-in user to `roleHomePath(role)` when they open the other role's
  routes. `GuestRoute` keeps signed-in users out of the landing/login/register pages.
- Doctor APIs already existed from Phase 13: assigned-patient listing, invitation listing and
  creation, patient-scoped readings, patient-scoped daily/MTD/monthly reports, and patient-scoped
  report jobs. All patient-scoped requests re-check the active assignment server-side.
- Shared UI already existed: `Button`, `Card`, `Input`/`Field`, `StatusNote`, authored SVG icons,
  `ReadingsList`, `ReadingsPagination`, `DailyReportView`, `PeriodReportView`, and the chart
  components. No new dependencies were added.
- The client test suite had 98 tests in 10 files; server role/RBAC tests already covered the
  backend boundaries.

## 2. Existing backend APIs reused

No backend endpoint, schema, migration, cache key, or worker contract was changed.

| Method | Endpoint                                                     | Use in the doctor panel                       |
| ------ | ------------------------------------------------------------ | --------------------------------------------- |
| `GET`  | `/api/doctor/patients`                                       | Dashboard count, directory, workspace header  |
| `GET`  | `/api/doctor/invitations`                                    | Dashboard pending list, invitation history    |
| `POST` | `/api/doctor/invitations`                                    | Invite a registered patient by email          |
| `GET`  | `/api/doctor/patients/:patientId/readings`                   | Paginated workspace readings and date filter  |
| `GET`  | `/api/doctor/patients/:patientId/reports/daily`              | Daily report tab                              |
| `GET`  | `/api/doctor/patients/:patientId/reports/month-to-date`      | Month-to-date report tab                      |
| `GET`  | `/api/doctor/patients/:patientId/reports/monthly`            | Previous-month report tab                     |
| `POST` | `/api/doctor/patients/:patientId/reports/jobs`               | Background report generation                  |
| `GET`  | `/api/doctor/patients/:patientId/reports/jobs/:jobId`        | Background job status polling                 |

The client still uses the existing `services/doctorApi.ts` and `services/http.ts` wrappers. No
assignment state is cached across navigations or trusted for authorization; every patient route
loads through the server-checked APIs.

## 3. New pages and routes

| Route                            | Page                         | Purpose                                                                   |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `/doctor/dashboard`              | `DoctorDashboardPage`        | Assigned count, pending invitations, recently accepted patients, states   |
| `/doctor/patients`               | `DoctorPatientsPage`         | Assigned-patient directory with client-side name/email filter             |
| `/doctor/patients/:patientId`    | `DoctorPatientPage`          | Read-only readings, charts, reports, filters, pagination, background jobs |
| `/doctor/invitations`            | `DoctorInvitationsPage`      | Create invitations and filter pending/accepted/expired/revoked states     |
| `/patients` (legacy)             | `LegacyPatientRedirect`      | Redirect to `/doctor/patients`                                            |
| `/patients/:patientId` (legacy)  | `LegacyPatientRedirect`      | Redirect to `/doctor/patients/:patientId`                                 |

Patient routes remain `/today`, `/readings`, `/reports`, and `/care-team`.

## 4. Components created or reused

Created:

- `components/layout/PatientLayout.tsx` — the previous patient shell, extracted unchanged in
  behaviour from `AppLayout.tsx` (which was removed).
- `components/layout/DoctorLayout.tsx` — persistent desktop sidebar, mobile disclosure navigation,
  page-change focus handling, and a denser content width.
- `components/doctor/DoctorUi.tsx` — only the small repeated doctor primitives: `StatCard`,
  `StatusPill`, `ReadonlyPill`.
- `lib/doctor.ts` — date formatting and invitation state/label/tone helpers.
- `pages/DoctorDashboardPage.tsx`, `pages/DoctorInvitationsPage.tsx`.

Reused:

- `Button`, `LoadingState`, `Spinner`, `Card`, `Field`, `Input`, `StatusNote`, `useStatusNote`.
- Authored SVG icons; four new 16 px / 1.5-stroke icons were added to the same set (`GridIcon`,
  `UsersIcon`, `MailIcon`, `MenuIcon`, plus `ArrowLeftIcon`, using the existing `CloseIcon`).
- `ReadingsList`, `ReadingsPagination`, `DailyReportView`, `PeriodReportView`, and the existing
  glucose charts.
- `services/doctorApi.ts`, `services/http.ts`, and the existing `ApiError` handling.

Design direction (unslop): exact, clinical, calm. The warm cream/surface/ink foundation and olive
accent are shared; the doctor panel adds density through layout rather than new colour. No
gradients, glass effects, emoji navigation, ornamental animation, or generic admin-template
chrome. The signature detail is the thin forest rule on the active sidebar item plus the
“consent since” metadata, both derived from real assignment data.

## 5. Role-based routing implementation

- `roleHomePath('doctor')` now returns `/doctor/dashboard`; patient home remains `/today`.
- Routes are nested as `RequireAuth → RequireRole(role) → role layout → pages`, so the correct
  shell only mounts after the server-provided role is known.
- `RequireAuth` and `RequireRole` render a full-page loading state while `/api/auth/me` resolves.
  This prevents both a login-form flash and a wrong-role redirect during loading.
- A patient opening any `/doctor/*` route is redirected to `/today`; a doctor opening a
  patient-only route is redirected to `/doctor/dashboard`.
- Old Phase 13 `/patients*` doctor bookmarks redirect inside the doctor guard.
- `services/http.ts` now emits `sweety:session-expired` on any `401` response. `AuthProvider`
  listens and resets the user to `unauthenticated`, so the next render sends the user to `/login`
  through the existing guards. Callers still receive their `ApiError` for local error UI.
- No automatic role switching and no client-side authorization replacement were added; the server
  still re-checks role and consent on every request.

## 6. Patient Panel preservation

- `PatientLayout` preserves the existing header, `Today / Readings / Reports / Care team`
  navigation, account display, logout, page-change focus, and motion behaviour.
- All patient pages, reading create/edit/delete flows, charts, reports, pagination, settings, and
  care-team consent controls are untouched.
- Patient navigation contains no doctor routes. The doctor panel never renders patient-only
  navigation, and no doctor write controls exist.
- No patient-side API or route was renamed.

## 7. Responsive behavior and accessibility

- Desktop: 240 px doctor sidebar (`lg`/`xl`), 1280 px max content width, dense table-like rows and
  compact stat cards.
- Tablet/mobile: sidebar is hidden; a labelled `Menu` button with `aria-expanded`/`aria-controls`
  opens the same navigation, and selecting a link closes it. Patient navigation remains the
  existing responsive header.
- Directory rows stack on small screens and align into patient/access/arrow columns from `sm`.
- Filters and status pills use text as well as colour; counts are plain tabular text.
- Semantic `h1`/`h2` headings, labelled form fields, `aria-live` result counts, `role="group"` for
  invitation filters, `aria-selected` report/patient tabs, and visible focus styles are preserved.
- Loading states use the shared `role="status"` component; errors are plain text with a retry
  action.
- Doctor reading access uses `ReadingsList` without `onEdit`/`onDelete`, so edit/delete controls
  cannot render. A visible `Read-only` badge reinforces the constraint.

## 8. Tests added and actual results

Client: **113 passed / 11 files** (`npm test --workspace @sweety/client`). Server: **303 passed /
18 files** (`npm test --workspace @sweety/server`). Total: **416 passing tests across 29 files**.

Added or updated coverage:

- `App.test.tsx`: doctor login redirects to the doctor dashboard; doctor on a patient route
  redirects to the doctor home; patient on `/doctor/patients` redirects to `/today`; legacy
  `/patients` redirects to `/doctor/patients`; no login-form flash while auth is loading.
- `pages/DoctorPanel.test.tsx`: dashboard assigned count, pending invitations, consent dates,
  empty state; assigned-only directory, client-side search without extra requests, empty state,
  failure/retry; workspace readings, read-only badge, no edit/delete buttons, failure message;
  invitation states (pending/accepted/expired/revoked), filter behaviour, creation and one-time
  token display, failure/retry.
- `services/http.test.ts`: `401` dispatches the session-expired event exactly once.

Tests mock `authApi` / `doctorApi`; no real backend or production network requests are made.

## 9. Build and lint results

- `npm run typecheck --workspace @sweety/client` — passed, zero type errors.
- `npm run build --workspace @sweety/client` — passed (Vite production build, 497 modules).
- `npm run lint` — passed with no warnings or errors after splitting doctor helpers out of the
  component file and removing a synchronous setState effect.
- Prettier — all changed files pass `prettier --check`; `README.md` was formatted.

## 10. Screenshots or browser verification evidence

The Docker stack was already running (client on `5173`, server/API healthy). Verification:

```text
GET http://localhost:5173/doctor/dashboard    → 200
GET http://localhost:5173/doctor/patients     → 200
GET http://localhost:5173/doctor/invitations  → 200
GET http://localhost:5173/api/health          → 200
```

The Vite client log showed successful HMR/compilation of the new doctor layout and pages. No
screenshots were captured: Playwright is not installed as a project dependency, and the browser
cache alone cannot drive an authenticated session. The UI behaviour was verified through the
React Testing Library suite rather than by adding a test dependency or seeding/modifying the
reviewer's database.

## 11. Backend gaps or known limitations

- `GET /api/doctor/patients` has no search, sort, pagination, or last-reading-date fields. The
  directory therefore loads the full assigned list and filters name/email client-side; no
  directory pagination is offered.
- There is no doctor-side “recent reading activity” or last-reading endpoint, so the dashboard
  shows assignment/invitation facts only. It does not fabricate clinical activity.
- Invitation tokens are still delivered out of band; there is no email integration. The raw token
  is displayed once, is never placed in the URL or storage, and is not logged by the client.
- Doctor access remains read-only. No create/edit/delete, diagnosis, treatment, appointment,
  prescription, chat, admin role, or doctor self-registration was added.
- The doctor workspace can queue background reports through the existing API and polls status at
  one-second intervals only while a job is active. On completion it re-fetches the visible report
  tab rather than trusting the job payload.
- No screenshots; see section 10.

## 12. Files changed

Modified:

- `README.md`
- `apps/client/src/App.tsx`
- `apps/client/src/App.test.tsx`
- `apps/client/src/components/ui/icons.tsx`
- `apps/client/src/context/AuthContext.tsx`
- `apps/client/src/pages/DoctorPatientsPage.tsx`
- `apps/client/src/pages/DoctorPatientPage.tsx`
- `apps/client/src/services/http.ts`
- `apps/client/src/services/http.test.ts`
- `apps/client/src/types/user.ts`

Added:

- `apps/client/src/components/layout/PatientLayout.tsx`
- `apps/client/src/components/layout/DoctorLayout.tsx`
- `apps/client/src/components/doctor/DoctorUi.tsx`
- `apps/client/src/lib/doctor.ts`
- `apps/client/src/pages/DoctorDashboardPage.tsx`
- `apps/client/src/pages/DoctorInvitationsPage.tsx`
- `apps/client/src/pages/DoctorPanel.test.tsx`
- `.agents/tasks/phase13.1-doctor-panel-report.md`

Removed:

- `apps/client/src/components/layout/AppLayout.tsx` (superseded by `PatientLayout.tsx`)

No commits, pushes, database schema changes, destructive Git operations, or unrelated file changes
were made.
