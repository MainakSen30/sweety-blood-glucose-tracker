# SWEETy – Demo Walkthrough Script

A step-by-step script for recording a walkthrough or preparing a live demonstration of SWEETy – Blood Glucose Tracker.

## Setup before recording

1. Start the application:
   ```bash
   npm run dev
   ```
2. Load the demo data (creates the demo account and 30 days of synthetic readings):
   ```bash
   SEED_DEMO_DATA=true npm run db:seed
   ```
   Or via Docker Compose (if running with `docker compose up`):
   ```bash
   docker compose exec server sh -c "SEED_DEMO_DATA=true /app/node_modules/.bin/tsx /app/apps/server/src/database/seed.ts"
   ```
3. Open a browser at `http://localhost:5173`.
4. Set the viewport to **1280 × 800** (DevTools → device toolbar → custom dimensions).
5. Ensure no personal data is visible.

---

## Step 1 — Landing page

**URL:** `http://localhost:5173/`

- Show the landing page hero section.
- Point out: the product name, the tagline, and the two entry points (Log In / Get Started).
- Do not proceed; stay on this page for 3–5 seconds.

---

## Step 2 — Log in with demo credentials

**URL:** `http://localhost:5173/login`

- Click **Log In** (or navigate directly to `/login`).
- Enter the demo credentials:
  - **Email:** `demo@sweety.local`
  - **Password:** `Demo1234!`
- Click **Log In**.
- Wait for the dashboard to load.

---

## Step 3 — View the dashboard

**URL:** `http://localhost:5173/today`

- Show the time-aware greeting ("Good morning", "Good afternoon", or "Good evening").
- Scroll through the four daily reading slots (Morning, After Breakfast, After Lunch, After Dinner).
- If today has readings from the seed script, they will be pre-filled. If not (the seed only goes back 1–30 days from today), the slots will show empty placeholders — that is expected.
- Show the month-to-date and previous-month overview summary cards at the bottom of the dashboard.

---

## Step 4 — Add a glucose reading

- On the dashboard, click **Add** next to any empty slot (for example, the Morning slot).
- The reading form dialog opens.
- Fill in:
  - Date: today's date (pre-filled)
  - Slot: Morning (pre-selected by the button you clicked)
  - Value: `102`
- Click **Save**.
- The dashboard refreshes and the new reading appears in the Morning slot.

---

## Step 5 — View reading history

**URL:** `http://localhost:5173/readings`

- Navigate to the Readings page (via the navigation menu or sidebar).
- Show the full history grouped by date.
- Scroll through several dates to demonstrate the synthetic data from the seed script.
- Optionally use the date filter to show readings for a single day.

---

## Step 6 — Edit and delete a reading

**On the Readings page or Dashboard:**

- Click the **Edit** icon on any reading.
- Change the value (for example from `102` to `108`).
- Click **Save**. Confirm the value updated in the list.
- Click the **Delete** icon on the same reading.
- Confirm the deletion dialog.
- The reading disappears from the list.

---

## Step 7 — View the daily report

**URL:** `http://localhost:5173/reports`

- Navigate to the Reports page.
- The **Daily** tab is selected by default.
- Choose a date that has readings (the seed script adds readings for T-1 through T-30).
- Show the bar chart of the four daily slots.
- Point out the summary statistics: Highest, Lowest, Average, Total Readings.

---

## Step 8 — Explore month-to-date and previous-month reports

**Still on `http://localhost:5173/reports`:**

- Click the **Month-to-Date** tab.
- Show the aggregate summary (highest, lowest, average, total readings for the current month up to today).
- Click the **Previous Month** tab.
- Show the aggregate summary for the full previous calendar month.
- Note that all aggregates are computed from actual recorded readings only — no interpolation, no fabricated values.

---

## Step 9 — Log out

- Click the user menu or the **Log Out** button in the navigation.
- Confirm the session ends and the browser redirects to the landing page (`/`).
- Note: the HTTP-only cookie is cleared server-side; there is no token in browser storage.

---

## Notes for the recording

- All glucose values shown are **synthetic demonstration data** — they have no medical significance.
- The demo account (`demo@sweety.local`) is created by the seed script and can be re-seeded at any time by running `SEED_DEMO_DATA=true npm run db:seed` again (idempotent — it will not create duplicate readings).
- Do not show or mention real personal health data during the recording.
