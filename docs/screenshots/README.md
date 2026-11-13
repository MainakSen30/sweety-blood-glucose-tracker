# SWEETy – Screenshot Capture Instructions

This directory holds screenshots for the project README. Playwright is not installed in this repository, so screenshots must be captured manually.

## Prerequisites

Before capturing:

1. The application must be running locally. Start it with:
   ```bash
   npm run dev
   ```
2. The seed data must be loaded so realistic readings are visible:
   ```bash
   # Ensure SEED_DEMO_DATA=true is in .env (or prepend it inline)
   npm run db:seed
   ```
3. Demo credentials:
   - **Email:** `demo@sweety.local`
   - **Password:** `Demo1234!`
4. Use a browser window set to exactly **1280 × 800** pixels viewport. In Chrome/Edge, open DevTools → toggle device toolbar → set custom dimensions to 1280 × 800.

## Screenshots to capture

### `01-landing.png` — Landing page

- URL: `http://localhost:5173/`
- State: not logged in
- Notes: capture the full landing page with the hero headline and call-to-action buttons visible

### `02-login.png` — Login page

- URL: `http://localhost:5173/login`
- State: empty login form (not yet submitted)
- Notes: show the email and password fields

### `03-register.png` — Registration page

- URL: `http://localhost:5173/register`
- State: empty registration form
- Notes: show the name, email, password, and confirm-password fields

### `04-dashboard.png` — Dashboard

- URL: `http://localhost:5173/today`
- State: logged in as `demo@sweety.local` with synthetic readings visible
- Notes: the four daily slots should show today's or recent readings; the MTD and previous-month overview cards should contain data from the seed script

### `05-readings.png` — Readings history page

- URL: `http://localhost:5173/readings`
- State: logged in as `demo@sweety.local`
- Notes: the full reading history grouped by date should be visible; scroll to show at least 2–3 dates

### `06-daily-report.png` — Daily report with chart

- URL: `http://localhost:5173/reports`
- State: logged in; daily tab selected; a date with 4 readings selected (run `npm run db:seed` first to populate data)
- Notes: the bar chart and summary statistics (highest, lowest, average, total) should all be visible

### `07-monthly-reports.png` — Monthly reports view

- URL: `http://localhost:5173/reports`
- State: logged in; switch to either the month-to-date or previous-month tab
- Notes: show the summary statistics panel; if the chart is visible, include it

## Saving screenshots

Save each file to this directory (`docs/screenshots/`) with the exact filenames listed above.

After saving, the README section **Screenshots** will automatically render them from the repo-relative path `docs/screenshots/<filename>`.

## Consistent viewport note

All screenshots must use the **same 1280 × 800 viewport**. Mixed sizes make the gallery look inconsistent in the README.

Do not include personal glucose data, real user names, or any real email addresses. The seed script's synthetic data is safe to show.
