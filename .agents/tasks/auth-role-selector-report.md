# Authentication UI Enhancement — Patient / Doctor Selection

Implementation date: 14 November 2026

## 1. Existing authentication architecture

- React 19 + Vite SPA in `apps/client`, React Router 7, Tailwind CSS 4, Motion for animation.
- Session state lives in `context/AuthContext.tsx`. The HTTP-only cookie is the session; the client
  asks `GET /api/auth/me` who it belongs to. Nothing is read from `localStorage`, a URL parameter, or
  a client flag.
- `services/authApi.ts` wraps `POST /api/auth/register`, `POST /api/auth/login`,
  `POST /api/auth/logout`, and `GET /api/auth/me` through `apiFetch` (`services/http.ts`), which
  sends `credentials: 'include'` and turns non-2xx responses into `ApiError`.
- Server: `apps/server/src/modules/auth/`. `registerSchema` accepts **only** `name`, `email`,
  `password`; `registerUser` calls `insertUser` without a role, so the database default `patient`
  always applies. `loginSchema` accepts `email` and `password`; `loginUser` returns the stored user
  including its role. There is no role parameter on either endpoint.
- Roles: `UserRole = 'patient' | 'doctor'` in `types/user.ts`, mirrored by `SafeUser.role` from the
  server. `roleHomePath()` maps patient to `/today` and doctor to `/doctor/dashboard`.
- Redirects: `RequireAuth` sends visitors to `/login` with `state.from`; `GuestRoute` sends signed-in
  users to `roleHomePath(user.role)`; `RequireRole` sends a role to its own home. `LoginPage` and
  `RegisterPage` navigate to `state.from` / `roleHomePath(user.role)` after success.
- Doctor accounts are never self-registered. `apps/server/src/modules/auth` rejects no role field
  because it never reads one, and provisioning happens through the audited
  `db:promote-doctor` CLI.

## 2. Role selector implementation

One reusable component, `components/auth/RoleSelector.tsx`, is rendered by both authentication
screens:

- Two equal-weight cards in a `grid grid-cols-2` group (`role="group"`, `aria-label="Sign in as"`
  or `"Create account as"`).
- Each card is a real `<button type="button" aria-pressed={selected}>`, so Tab/Enter/Space work
  natively and assistive technology receives the selected state.
- Patient uses a new `PersonIcon`, Doctor a new `StethoscopeIcon`; both follow the existing authored
  16 px / 1.5-stroke icon set. No emoji, no icon dependency.
- Copy: Patient — “Track and manage your glucose readings.”, Doctor — “Access and monitor your
  assigned patients.”
- Selected state: `border-olive-dark bg-sage/20`, dark icon chip, olive-dark label. Unselected:
  `border-line bg-surface` with a hover tint. Because only colours change, nothing shifts.
- Transitions are 150 ms colour transitions (the codebase's existing convention for state toggles)
  plus a 180 ms Motion scale on the icon chip, disabled under `prefers-reduced-motion`.
- Placement: first element inside the auth card, above a hairline divider, then the form. Spacing
  comes from the existing card padding and `mt-5`.

No new colour tokens, fonts, or dependencies were introduced.

## 3. Login behavior

- Patient is selected by default; selecting Doctor updates the pressed state, clears any stale form
  error, and adjusts the subtitle to “Sign in to review your assigned patients.”
- Email/password fields, show/hide password, field validation, loading state, and `ApiError`
  messages are unchanged.
- On submit the page calls `login({ email, password }, selectedRole)`. The provider performs the
  existing `POST /api/auth/login`, reads the role from the server response, and only commits the
  session when it matches the selected role. The page then navigates to `state.from` or
  `roleHomePath(user.role)`.
- The selected role is never sent to the server, stored, or used as authorization.

## 4. Role mismatch handling

`AuthContext` now exposes `login(input, expectedRole)`. On a mismatch it:

1. revokes the cookie the login call just issued (`POST /api/auth/logout`, best effort);
2. throws `RoleMismatchError` carrying the account's **actual** role;
3. leaves the auth state `unauthenticated`, so no guard can route into a panel.

`LoginPage` catches it and shows a non-sensitive inline alert: “This is a doctor account. Select
Doctor to sign in.” The visitor stays on the login screen with their input intact and can switch the
selector. The check happens inside the provider deliberately: `GuestRoute` redirects any
`authenticated` user, so committing the session first and logging out afterwards would flash a
dashboard and lose the message.

No role is ever modified during login, and the backend authorization boundary is untouched.

## 5. Registration behavior

- The same selector appears above the form, defaulting to Patient and accepting the role passed from
  the Login page.
- Patient keeps the existing name/email/password/confirm flow, validation, and error handling. The
  request body is still exactly `{ name, email, password }`.
- Selecting Doctor replaces the form with an inline notice inside the same card: “Doctor accounts are
  created by invitation”, explaining that a clinic or administrator provisions the account, with a
  `Continue as a patient` button and a `Sign in instead` link that carries the Doctor selection to
  Login. There is no red error styling — it is an explanation, not a failure.
- `handleSubmit` returns early unless the selected role is `patient`, as a second guard against the
  form ever being reachable in doctor mode.

## 6. Doctor registration security restrictions

- No public path can create a doctor account: the form is not rendered, no request is submitted,
  and `registerSchema` on the server has no `role` field, so a crafted request with `role: "doctor"`
  is simply ignored and the account is created as `patient`.
- The UI never calls the doctor-provisioning CLI or any promotion endpoint; there is none.
- The role selector is presentation only. The server-derived role still decides every route and API
  response, and `RequireRole` re-checks it after authentication.

## 7. Components modified or created

Created:

- `apps/client/src/components/auth/RoleSelector.tsx` — the shared selector.
- `apps/client/src/pages/AuthRoleSelector.test.tsx` — new test file.
- `.agents/tasks/auth-role-selector-report.md` — this report.

Modified:

- `apps/client/src/pages/LoginPage.tsx` — selector, role-aware subtitle, mismatch handling.
- `apps/client/src/pages/RegisterPage.tsx` — selector, doctor provisioning notice, patient-only
  submit guard, role carried between screens.
- `apps/client/src/context/auth.ts` — `login(input, expectedRole)` signature and
  `RoleMismatchError`.
- `apps/client/src/context/AuthContext.tsx` — role check before committing the session; cookie
  revocation on mismatch.
- `apps/client/src/components/ui/icons.tsx` — `PersonIcon`, `StethoscopeIcon`.
- `apps/client/src/App.tsx` — `/patient/dashboard` alias redirecting to the existing patient home
  `/today`.
- `README.md` — authentication features, panel notes, test counts, Phase 13.2 section.

No server file, schema, migration, dependency, or dashboard page was changed.

## 8. Selection persistence between screens

The footer links pass `state={{ role }}`. Login → “Create an account” and Sign Up → “Sign in” (plus
the doctor notice's “Sign in instead”) therefore keep the chosen card. It is router state, not a URL
parameter or storage, and it is only used to pick the initial card, never for authorization.

## 9. Tests and actual results

`npm test --workspace @sweety/client` — **127 passed / 12 files** (was 113 / 11).

New `AuthRoleSelector.test.tsx` renders the real pages inside the real `AuthProvider` with
`authApi` mocked:

Login

- Patient selected by default (`aria-pressed`)
- Switching to Doctor updates both pressed states
- Keyboard: Tab reaches Patient, Tab reaches Doctor, Enter selects Doctor
- Patient login redirects to `/today`
- Doctor login redirects to `/doctor/dashboard`
- Role mismatch (doctor account, Patient selected) shows the inline alert, stays on Login, does not
  reach either home, and calls `logoutUser`
- Existing field validation still fires and makes no request
- `ApiError` authentication failures are shown
- Doctor selection survives navigation into registration

Registration

- Patient registration succeeds and sends exactly `{ name, email, password }` — no role field
- Selecting Doctor removes the form, shows the provisioning notice, and never calls `registerUser`
- “Continue as a patient” restores the patient form
- Existing registration validation still fires

Server suite: unchanged by this work; `npm test --workspace @sweety/server` — **303 passed / 18
files**. Total **430 passing tests across 30 files**.

## 10. Build and lint results

- `npm run typecheck --workspace @sweety/client` — passed, zero errors.
- `npm run build --workspace @sweety/client` — passed (498 modules, production bundle).
- `npm run lint` — passed with no errors or warnings.
- Prettier — all changed files pass `--check`.

## 11. Browser verification

Checked against the running Docker stack (`http://localhost:5173`) with headless Chrome and the
DevTools protocol:

- Login at 390 px and 1280 px: both selector buttons render at identical width and height, no
  horizontal overflow (`scrollWidth === innerWidth`), no text overflow inside either card.
- Patient renders `aria-pressed="true"` with `border-olive-dark`; clicking Doctor flips both states
  and updates the subtitle.
- Registration at 390 px with Doctor selected: form absent, notice present, no horizontal overflow.
- `/patient/dashboard` is covered by the routing test: a patient landing there ends on `/today`
  with the patient navigation, and no doctor routes are mounted.

Screenshots were written to the session temp folder for the record, but the review environment can
only inspect DOM measurements and text, not pixels, so no pixel-level aesthetic judgement is claimed
here.

## 12. Remaining backend limitations

- The login API returns the authenticated user's role but takes no expected-role parameter. The
  client therefore compares roles after the call and revokes the cookie on mismatch. A server-side
  `expectedRole` check would save one round trip, but it is not needed for correctness and would be a
  contract change, so it was not added.
- There is still no public doctor registration, invitation-based doctor onboarding, or self-service
  role request. Doctor accounts require the existing audited CLI. The UI explains this rather than
  inventing an approval flow.
- Role selection is remembered only through router state while moving between Login and Sign Up; a
  full page reload returns to Patient. Persisting it in storage would add a client-side flag for no
  functional gain.
- The patient home remains `/today`; `/patient/dashboard` is an alias so the requested path works
  without renaming routes, navigation, docs, and tests.
