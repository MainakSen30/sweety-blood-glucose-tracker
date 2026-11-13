# Reports Dashboard: Readings by Time Slot Donut Chart

## Data sourcing decision

Slot counts are derived client-side from existing reading arrays — no API changes were made. For the daily tab, `DailyReport.readings[]` (each with a `.slot` field) is passed directly to `slotCounts()`. For period tabs, `state.periodReadings` (a `Reading[]` already fetched via `listReadings`) is passed. This reuses data already in memory and avoids any new endpoints or backend changes.

## Chart library used

Plain SVG — no external chart library introduced. The existing codebase has no chart library (`ValueBars` is a hand-drawn div/CSS component). The donut chart uses the `stroke-dasharray` / `stroke-dashoffset` technique on `<circle>` elements with `r=15.9155` (circumference ≈ 100), so percentage values map 1:1 to dash lengths. This is consistent with the project's zero-dependency philosophy for charts.

## Color choices

Four muted, earthy shades derived from the existing olive/sage palette:

| Slot | Color | Hex | Relationship to palette |
|---|---|---|---|
| Morning | Olive | `#596747` | Matches `--color-olive`, same as bar chart bars |
| After breakfast | Sage-olive | `#8a9b78` | Lighter olive, mid-point toward `--color-sage` |
| After lunch | Pale sage | `#c5cbb8` | Desaturated, close to `--color-sage` (#dce3d3) |
| After dinner | Warm sand | `#d4a97a` | Muted blend between `--color-beige` and `--color-terracotta` |

Background track uses `--color-line` (`#e4e0d3`). No bright, saturated, or new accent colors were introduced.

## Layout implementation

Both chart views (daily and period) now use a single `Card` with a flex container:

- Mobile/tablet: `flex-col` — bar chart stacks above donut chart
- Desktop (`lg:`): `flex-row` — bar chart at `flex-[65]`, donut chart at `flex-[35]`

The donut SVG is 144×144px (mobile) / 160×160px (desktop), keeping the chart compact and not increasing overall page height on desktop. The center hole is created by the SVG background showing through — the SVG uses `fill="none"` on all circles.

The SVG is rotated `-90deg` via Tailwind's `-rotate-90` to place the first segment at 12 o'clock. The center label `div` with `absolute inset-0` overlays the SVG and is not rotated.

## Files changed

| File | Change |
|---|---|
| `apps/client/src/lib/chart.ts` | Added `slotCounts()` utility function |
| `apps/client/src/components/charts/SlotDonutChart.tsx` | New component — SVG donut chart |
| `apps/client/src/pages/ReportsPage.tsx` | Added imports; updated `DailyReportView` and `PeriodReportView` chart sections |
| `apps/client/src/lib/chart.test.ts` | New test file for `slotCounts()` |
| `apps/client/src/components/charts/SlotDonutChart.test.tsx` | New test file for `SlotDonutChart` |

## Test cases and results

### `slotCounts` (chart.test.ts) — 4 tests, all pass

- Counts each slot correctly from a mixed reading array
- Returns zeros for all slots on empty array
- Does not double-count readings (10 morning-only → total = 10)
- Handles readings with only some slots present

### `SlotDonutChart` (SlotDonutChart.test.tsx) — 8 tests, all pass

- Renders empty state when total is zero
- Does not render an SVG when total is zero
- Renders total reading count (32) in center
- Renders all four slot labels in the legend
- Renders correct percentages (31.3%, 25.0%, 18.8%, 25.0%)
- Renders reading counts in legend
- Renders an accessible SVG with role="img"
- Handles counts with only one slot having readings

## Full verification results

```
npm test          → 6 test files, 33 tests — all passed
npm run typecheck → tsc --noEmit — no errors
npm run lint      → eslint — no errors (root-level script)
npm run format:check → prettier --check — all files pass (root-level script)
npm run build     → tsc --noEmit + vite build — 484 modules, built in 108ms
```

Note: `lint` and `format:check` are root-level workspace scripts (`/sweety/package.json`), not in the client `package.json` directly. The client `package.json` has no `lint` or `format:check` scripts.

## Known limitations

- The donut chart does not animate (consistent with the design constraint: "Do not add unnecessary animations").
- The `<title>` elements on individual SVG `<circle>` segments provide hover tooltips in browsers that support SVG title tooltips; this is not universal across all browsers/platforms but is the standard accessible SVG tooltip mechanism.
- The `100.0%` percentage renders when only one slot has readings, which is visually correct. The other slots show `0.0%` in the legend — these zero entries are intentional to always show all four slots for consistency.
