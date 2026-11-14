# SWEETy — Animation Consistency and Motion Design Audit

**Audit date:** 14 November 2026  
**Scope:** `apps/client` (React 19, Motion 14.13, Tailwind CSS 4)  
**Mode:** Audit only — no application code, animation values, CSS, dependencies, lockfiles, or git history were changed.  
**Report:** `.agents/tasks/animation-consistency-audit.md`

---

## A. Executive summary

SWEETy's motion is already unusually restrained and calm for a React app. There are **no decorative loops, no parallax, no scroll reveals, no springs, no gesture animations, no layout animations, and no `transition: all`**. Motion is used in eight files, the animated properties are transform/opacity or colour/border feedback, and the palette, type, spacing, and card treatment stay coherent. This is a strong base, not a rewrite candidate.

The problems are not "too much animation". They are **coordination, accessibility, and a missing source of truth**:

1. The authenticated page entrance and the Dashboard's first card entrance are **two separate animations that overlap**, so the main card arrives after the rest of the page.
2. `prefers-reduced-motion` is handled **three different ways**: per-component `useReducedMotion`, a global CSS kill switch, and one component that ignores it. The global rule freezes the loading spinner but does not stop Motion's movement.
3. The landing page uses **`ease-in`** on all three entrance blocks while every other surface uses the house `cubic-bezier(0.23, 1, 0.32, 1)`.
4. The modal moves focus in, but **does not trap it**; Tab walks into the page behind the dialog, and the delete flow can lose focus entirely.
5. The Reports tab paints the **previous period's numbers** while the next request is in flight, with no loading signal.
6. There is **no shared motion token or variant file**. The house curve is copied into seven places and five durations are used inline, which is why the landing drift went unnoticed.

**Finding count: 20 — 0 Critical, 6 High, 7 Medium, 7 Low.**

**Aceternity UI:** the premise does not match this repository. There is **no Aceternity dependency, import, component, CSS, or git-history reference**. The app is built from custom Tailwind surfaces plus `motion/react`. Nothing Aceternity-related needs removing or preserving; see section D before adding it.

**Recommendation:** fix the six High findings first (several are one-file changes), then introduce a small `motion.ts` token/variant file and migrate the eight Motion surfaces. Do not add an animation library, do not convert hover feedback to Motion, and do not animate every card.

**Visual verification:** performed with Chrome 156 headless over CDP against the running Docker dev client (`http://localhost:5173`), logged in with the demo account. Desktop 1280×800 and mobile 390×844 screenshots were captured, computed transform/opacity were sampled frame-by-frame for normal and reduced motion, the modal focus order was exercised, and the Reports tab transition was timed. Details and limits in section I.

---

## A2. Remediation status — 14 November 2026

All six High findings are fixed, together with the cheap Low/Medium items that shared the same files. No animation library was added and the cream/olive identity is unchanged.

| Finding | Status | Change |
|---|---|---|
| **H1** Dashboard double entrance | **Fixed** | Removed the nested `motion.div` from `DashboardPage`; AppLayout owns the single page entrance. |
| **H2** Dashboard ignores reduced motion | **Fixed** | Dashboard no longer animates; `<MotionConfig reducedMotion="user">` now wraps the app in `main.tsx` as a backstop. |
| **H3** Global CSS kill switch freezes feedback | **Fixed** | Replaced the `*` rule with a targeted spinner rule that slows it to 2 s; button press is `motion-safe:`. |
| **H4** Landing uses `ease-in` | **Fixed** | All three entrances now use the house curve `[0.23, 1, 0.32, 1]`. |
| **H5** Modal focus escapes / restore race | **Fixed** | `#root` is `inert` while open, Tab loops inside the panel, setup runs mount-only with `onClose` in a ref, and focus is restored only if the element is still connected. |
| **H6** Stale report period | **Fixed** | Report data is keyed to the current tab/date request; a new request renders the labelled loading state instead of the previous period. |
| **M2** Reports moves data vertically | **Fixed** | Report swap is now an opacity-only 150 ms fade. |
| **M3** Bar stagger exceeds budget | **Fixed** | Bar growth is 180 ms with no stagger; the average line matches. |
| **M4** Feedback lifecycle | **Partial** | `useStatusNote.clear` is stable, so the 4 s timer no longer resets on parent renders. Exit animation and always-mounted live region remain open. |
| **M7** Inconsistent loading states | **Partial** | Dashboard, Readings, and Reports share `LoadingState` (`role="status"` + label). `aria-busy` regions and the Readings date-filter flash remain open. |
| **L1** Hover motion not gated | **Partial** | The button press scale is now `motion-safe:`. Broader hover gating remains open. |
| **L2** Dialog exit duration/curve | **Fixed** | 200 ms in, 150 ms out, same house curve in the reduced-motion branch. |
| **L4** Unkeyed dialog children | **Fixed** | Explicit `reading-form` / `delete-reading` keys. |
| **L5** Landing stair-step under reduced motion | **Fixed** | Both stagger delays are 0 when motion is reduced. |

**Still open (follow-up batch):** M1 (shared `motion.ts` tokens), M4 (status/error exit animation and mounted live region), M5 (auth-page arrival), M6 (chart-group behaviour decision), M7 remainder (`aria-busy`, Readings date-filter in-place update), L1 remainder, L3, L6, L7.

**Verification:** client tests 63/63, server untouched, `tsc --noEmit`, ESLint, and the production build all pass. Headless Chrome confirmed: the Dashboard card is a direct child of the page with no nested motion wrapper; the reduced-motion spinner runs at 2 s; the dialog sets `#root` inert, keeps every Tab inside the panel, closes on Escape, and clears inert; and a throttled Reports tab switch shows `Loading report` with no previous-period heading before the October data appears. No Vite error overlay.

---

## B. Animation inventory

### Pages

| Surface | File | Current motion | Reduced motion | Notes |
|---|---|---|---|---|
| Landing `/` | `apps/client/src/pages/LandingPage.tsx` | Three `motion.div` entrances: hero copy, preview panel, features row. `opacity 0→1`, `y 12→0`, 0.3 s, delays 0 / 0.07 / 0.14 s. Header/footer static. | `useReducedMotion` → opacity only (lines 55, 76–79, 100–103, 192–195) | Uses `ease: [0.42, 0, 1, 1]` — CSS `ease-in`. |
| Login `/login` | `apps/client/src/pages/LoginPage.tsx` | No page/section entrance. Field errors only (via `Field`). Form error is a plain paragraph. Show/Hide is a colour transition. | Field errors handled | Arrival is static while Dashboard/Reports animate. |
| Register `/register` | `apps/client/src/pages/RegisterPage.tsx` | Same as Login. | Field errors handled | Same inconsistency. |
| Dashboard `/today` | `apps/client/src/pages/DashboardPage.tsx` | Nested card entrance: `opacity 0→1`, `y 12→0`, 0.3 s, `delay 0.05` (lines 135–139). Only the "Today's readings" card. Other cards static. | **Not handled** | Runs inside the AppLayout entrance, producing two waves. |
| Readings `/readings` | `apps/client/src/pages/ReadingsPage.tsx` | No page-level motion beyond AppLayout. Static filter, list, pagination. Loading spinner. | CSS global only | No row enter/exit on add/delete; list updates jump. |
| Reports `/reports` | `apps/client/src/pages/ReportsPage.tsx` | Tab colour transition 150 ms; `AnimatePresence mode="wait"` around report content keyed by `tab + dailyDate + mtdDate`, `opacity 0→1`, `y ±8`, 0.18 s (lines 130–136). `ValueBars` grows. | `useReducedMotion` → opacity only | Old content exits before new enters; date changes replay the whole sequence. |
| App shell | `apps/client/src/components/layout/AppLayout.tsx` | Route wrapper keyed by `location.pathname`: `opacity 0→1`, `y 10→0`, 0.25 s (lines 71–78). Nav links colour 150 ms. | `useReducedMotion` → opacity only | The shell owns the page entrance correctly, but Dashboard adds a second one. |
| Auth shell | `apps/client/src/components/layout/AuthLayout.tsx` | Static. | n/a | No entrance on Login/Register. |

### Shared components

| Component | File | Current motion | Reduced motion | Notes |
|---|---|---|---|---|
| Button | `apps/client/src/components/ui/Button.tsx` | CSS `transition-[background-color,border-color,color,transform] duration-150`; `active:scale-[0.98]` (line 43). No Motion. | Global CSS kills the transition | Correct tool and properties. Hover not pointer-gated. |
| Spinner | `apps/client/src/components/ui/Button.tsx` | Tailwind `animate-spin` (line 53). | Global CSS freezes it | Decorative `aria-hidden`; parent supplies no status text on Dashboard/Readings. |
| Card | `apps/client/src/components/ui/Card.tsx` | None. | n/a | Correctly static. |
| Dialog | `apps/client/src/components/ui/Dialog.tsx` | Overlay opacity 0.2 s; panel `opacity + y 12 + scale 0.97`, 0.2 s, house ease (lines 42–69). Focus moved in and restored; body scroll locked. | Panel opacity only | No focus trap / `inert` background. Overlay does not change under reduced motion (opacity only anyway). |
| Field / Input | `apps/client/src/components/ui/Input.tsx` | Error paragraph: `opacity 0→1`, `y 4→0`, 0.15 s (lines 34–43). Input colour/border 150 ms. | `useReducedMotion` → opacity only | Error enters but never exits. |
| StatusNote | `apps/client/src/components/ui/StatusNote.tsx` | `opacity 0→1`, `y 4→0`, 0.15 s (lines 20–30). Auto-clears after 4 s. | `useReducedMotion` → opacity only | No `AnimatePresence`; disappears abruptly. New message does not re-animate. |
| Readings list | `apps/client/src/components/readings/ReadingsList.tsx` | Row action icon colour 150 ms. | Global CSS | No list insert/delete motion. |
| Pagination | `apps/client/src/components/readings/ReadingsPagination.tsx` | Select/button colour 150 ms. | Global CSS | Page change clears to a spinner, then new rows appear instantly. |
| Dialog orchestration | `apps/client/src/components/readings/useReadingDialogs.tsx` | `<AnimatePresence>` around conditional form/delete dialogs (lines 78–82). | Inherited from Dialog | Children are unkeyed custom components. |
| ValueBars | `apps/client/src/components/charts/ValueBars.tsx` | Bars `scaleY 0→1`, 0.25 s, house ease, stagger `min(index * 0.03, 0.3)` (lines 47–52). Average line fades 0.25 s (lines 57–63). Hover colour 150 ms. | `grow = animate && !reduceMotion` | Last bar starts at 300 ms and ends at 550 ms. |
| SlotDonutChart | `apps/client/src/components/charts/SlotDonutChart.tsx` | None. | n/a | Static SVG. |
| GlucoseTrendChart | `apps/client/src/components/charts/GlucoseTrendChart.tsx` | None. Tooltip shown by `group-hover` / `group-focus` via `hidden`/`block` (lines 111–135). Point colour 150 ms. | n/a | No chart entrance, unlike ValueBars. |
| ReportSummaryStats | `apps/client/src/components/reports/ReportSummaryStats.tsx` | None. | n/a | Static. |
| Icons / brand | `apps/client/src/components/ui/icons.tsx` | None. | n/a | Static SVG. |

### CSS and configuration

| Location | What exists | What does not exist |
|---|---|---|
| `apps/client/src/index.css` | Palette tokens; font; `:focus-visible`; global reduced-motion rule (lines 45–53). | No motion duration/easing tokens, no `@keyframes`, no `will-change`, no hover gating. |
| Tailwind usage | `transition-colors duration-150`, `animate-spin`, `active:scale-[0.98]`. | No custom animation utilities or variants. |
| `apps/client/package.json` | `motion ^14.13.0`, React 19. | No Aceternity package, no charting package. |
| `apps/client/src/main.tsx` | `BrowserRouter` only. | No `<MotionConfig>`. |

### Motion API search

Used: `motion`, `AnimatePresence`, `useReducedMotion`.

Not used anywhere: `useAnimation`, `useInView`, `whileHover`, `whileTap`, `whileInView`, variants, `layout`, `layoutId`, `LayoutGroup`, `MotionConfig`, `useSpring`, drag/gesture APIs, scroll listeners, `IntersectionObserver`. There are no CSS `@keyframes` beyond Tailwind's built-in spinner and no `transition: all`.

---

## C. Findings

### Critical (0)

No flow is blocked and no content is permanently unreachable; all primary flows (login, dashboard, readings, reports, add/edit/delete dialogs) complete. Two High findings are still release blockers in practice: the modal focus lifecycle (H5) and the stale report period (H6), because they affect keyboard users and data trust respectively.

### High (6)

#### H1. Dashboard double entrance: page wrapper and first card animate simultaneously

**Location:** `apps/client/src/components/layout/AppLayout.tsx:71–78`, `apps/client/src/pages/DashboardPage.tsx:135–139`

**Mechanism:** AppLayout remounts its keyed wrapper on every route change and fades/rises the whole page (`y 10→0`, 0.25 s). Dashboard then mounts its own card wrapper (`y 12→0`, 0.3 s, 0.05 s delay) after its data fetch resolves. The two are independent animations, not a parent/child variant.

**Evidence:** Headless Chrome frame sampling at 1280×800 on a fresh `/today` load:

| Element | First frame | End |
|---|---|---|
| `#main-content > div` (AppLayout) | t≈143 ms, `opacity 0`, `translateY(10px)` | ~393 ms, `opacity 1`, `none` |
| Dashboard card wrapper | t≈190 ms, `opacity 0`, `translateY(12px)` | ~490 ms, `opacity 1`, `none` |

The greeting and both lower cards never animate. The primary card therefore arrives in a second wave, ~100 ms after the page shell, and the page has two different rise distances (10 px and 12 px). Where the two transforms overlap they compose to ~22 px, and the two opacities multiply, so the first beat is dimmer and lower than either animation intended. On a slow data fetch the card can animate much later, after the page already looks settled.

**Impact:** The most-used screen has the least coherent entrance. It reads as a card "popping in" after the page, not as one page arriving. It also duplicates the same purpose (prevent a jarring mount) twice.

**Correction:** Remove the Motion wrapper from the Dashboard card and let AppLayout own the page entrance. If the post-fetch state needs emphasis, use a 150 ms opacity-only fade on the card content, not a second rise. Do not add a page entrance to Dashboard again.

---

#### H2. Dashboard ignores `prefers-reduced-motion`

**Location:** `apps/client/src/pages/DashboardPage.tsx:135–139`

**Mechanism:** Dashboard imports only `motion` (line 3), has no `useReducedMotion`, and always animates `y: 12 → 0`. Every other Motion surface branches to opacity-only. There is no `<MotionConfig reducedMotion="user">` safety net.

**Evidence:** With CDP `Emulation.setEmulatedMedia({name:'prefers-reduced-motion', value:'reduce'})`, a fresh `/today` load produced:

- AppLayout wrapper: `transform: none` throughout, opacity 0→1 (correct).
- Dashboard card: `matrix(1,0,0,1,0,12)` → `matrix(1,0,0,1,0,0)` over ~300 ms (movement still runs).

**Impact:** Motion-sensitive users explicitly asked the OS for less movement and still get a 12 px rise on the main screen. This is the only component that missed the established pattern, which is exactly the failure a per-component opt-in invites.

**Correction:** Add `useReducedMotion` and an opacity-only branch as the other components do **and** add `<MotionConfig reducedMotion="user">` at the app root as a backstop. The config does not replace explicit branches where they add clarity; it prevents the next component from forgetting.

---

#### H3. The global reduced-motion rule freezes loading indicators and does not cover Motion

**Location:** `apps/client/src/index.css:45–53`, `apps/client/src/components/ui/Button.tsx:51–53`

**Mechanism:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The blanket rule applies to every CSS animation and transition. It does not apply to Motion, which drives transforms/opacity through JS/WAAPI. So the app simultaneously over-reduces CSS feedback and under-reduces Motion.

**Evidence:** With reduced motion emulated, a synthetic `.animate-spin` element computed `animation-duration: 1e-05s` and `animation-iteration-count: 1`; a probe with `transition: transform 150ms` computed `transition-duration: 1e-05s`. The spinner becomes a static partial ring after one near-instant iteration. Meanwhile H2 shows Motion still moving.

**Impact:** Reduced-motion users lose the one continuous indicator that says "the app is working", while still receiving the movement they asked to avoid. The rule also removes button press and colour transitions entirely instead of making them gentler.

**Correction:** Stop using a global `*` kill switch. Keep Motion's opacity fallbacks for movement, and replace the CSS rule with a targeted one that removes transforms/position changes but keeps opacity/colour feedback. Keep a spinner that remains legible: either a slower rotation paired with visible text, or a static indicator paired with `Loading…`. See section G.

---

#### H4. Landing page entrances use `ease-in`, not the house curve

**Location:** `apps/client/src/pages/LandingPage.tsx:79, 103, 195`; contradicts `plans/001-landing-entrance.md:74, 87`

**Mechanism:** The three blocks use `ease: [0.42, 0, 1, 1]`, which is CSS `ease-in`. Every other entrance/exit uses `[0.23, 1, 0.32, 1]` (strong `ease-out`). The implementation plan for this exact work specifies the house curve.

**Impact:** `ease-in` starts slowly and delays the moment the user is watching. At 300 ms the hero copy, preview card, and features row all feel heavier than the Dashboard and Reports, which use the house curve. This is the clearest existing drift caused by inline animation values; it makes the public page and the product page feel like different products.

**Correction:** Change all three to `[0.23, 1, 0.32, 1]` (or the shared `EASE.out` token from section G). Do not add a second easing curve for the landing page. Keep the 70 ms stagger; it is within the 30–80 ms range and the total 440 ms is acceptable for a rare marketing entrance.

---

#### H5. Modal focus lifecycle is not actually modal

**Location:** `apps/client/src/components/ui/Dialog.tsx:22–40, 54–59`; `apps/client/src/components/readings/useReadingDialogs.tsx:64–70`; `apps/client/src/components/readings/DeleteReadingDialog.tsx:21–31`

**Mechanism:** The dialog moves focus to the panel on open, sets `aria-modal="true"`, and listens for Escape. It does **not** set `inert` on the rest of the app, does not loop Tab within the panel, and does not prevent focus from reaching the background. The full-screen close button is a focusable sibling of the panel, not a trap boundary.

There is a second focus bug: the effect that moves/restores focus depends on `[onClose]`. `DeleteReadingDialog` passes an inline `onClose={() => setDeleteTarget(null)}`, so every render (including `deleting` changing to true) tears the effect down and re-runs it. The cleanup restores focus to whatever was focused before the render, then the new effect saves the *current* active element and focuses the panel again. On success the dialog unmounts and tries to restore focus to the Delete button that is being removed, so focus can fall to `<body>`.

**Evidence:** Keyboard sequence after opening "Add reading" on `/readings`:

1. Dialog panel (`role="dialog"`)
2. Close button
3. Date input
4. Slot select
5. Value input
6. Cancel
7. Add reading
8. **`Sweety` link (outside dialog)**
9. **`Today` nav link**
10. **`Readings` nav link**
11. **`Reports` nav link**

Shift+Tab from the panel reaches the full-screen backdrop button first. The restore race is source-verified, not observed on a destructive delete.

**Impact:** Keyboard and screen-reader users can leave the modal without closing it, interact with the page behind it, and lose the modal context. `aria-modal` claims the rest of the page is unavailable while it is not. After a delete, focus can be lost entirely, forcing a keyboard user to start tabbing from the top of the page.

**Correction:** Put the app content behind an `inert` boundary while the dialog is open (preferred), or implement a Tab loop inside the panel. Make the dialog's `onClose` stable via `useCallback` in `useReadingDialogs`, and run the focus/scroll/keydown setup in a mount-only effect (`[]`) with the latest `onClose` kept in a ref. Keep the portal outside the inert root. Restore focus only if the saved element is still connected.

---

#### H6. Reports shows the previous tab's data while the next tab loads

**Location:** `apps/client/src/pages/ReportsPage.tsx:51–92, 153–167` (loading is only set by the initial state at line 46 and by `retry` at 94–97)

**Mechanism:** Changing the tab or date updates the `AnimatePresence` key immediately (line 132), but `loading` stays `false` and `state` still holds the previous response. The render condition at 159–166 therefore paints `PeriodReportView` with the old `state.period` under the new tab until the fetch resolves. Only the first load and explicit retry show the spinner.

**Evidence:** With the network throttled to 900 ms latency, switching from **Month to date** to **Previous month** produced:

| Time after click | Selected tab | Heading shown | Spinner |
|---|---|---|---|
| 6 ms | Previous month | `1–14 November 2026` (MTD data) | no |
| 1851 ms | Previous month | `1–31 October 2026` (correct) | no |

At normal local latency the swap happened by ~225 ms; on a slower connection the wrong period remains visible for the whole request.

**Impact:** A health app briefly presents the wrong reporting period under a tab the user just selected. This is a data-trust problem as well as a motion problem: the 180 ms exit animation and the fetch are not coordinated, and there is no loading signal. Users can read and act on stale numbers.

**Correction:** At the start of the effect, set `loading = true` and clear the period state (or track the request key and render only data matching the current tab/date). Show the existing `role="status"` spinner for the duration. If a completely blank panel feels too abrupt, keep the panel frame and show a skeleton/`aria-busy` region rather than old numbers.

---

### Medium (7)

#### M1. No shared motion tokens or variants; values are copied per component

**Location:** `AppLayout.tsx:75`, `DashboardPage.tsx:138`, `LandingPage.tsx:79/103/195`, `ReportsPage.tsx:136`, `Dialog.tsx:44`, `Input.tsx:39`, `StatusNote.tsx:26`, `ValueBars.tsx:19`

**Mechanism:** The house curve `[0.23, 1, 0.32, 1]` appears seven times; durations are 0.15, 0.18, 0.2, 0.25, 0.3 s; delays are 0, 0.05, 0.07, 0.14 s; the bar stagger is 0.03 s capped at 0.3 s. No file exports a duration, easing, transition, variant, or stagger constant. There is no `MotionConfig`.

**Impact:** The values are currently close, but nothing prevents drift — and drift already exists (H4). A component author has to remember the curve and duration, and accessibility handling is opt-in per component (H2). This is the systemic cause of most Medium findings below.

**Correction:** Add one small `apps/client/src/lib/motion.ts` with three durations, one entrance curve, four transitions, and four variants (page, fade, dialog panel, stagger). Keep hover/press feedback in CSS. See section G. Do not build a generic animation framework.

---

#### M2. Reports content waits for its exit before the new data appears, and moves vertically on a data view

**Location:** `apps/client/src/pages/ReportsPage.tsx:130–136` (key at line 132)

**Mechanism:** `<AnimatePresence mode="wait">` keyed on `${tab}-${dailyDate}-${mtdDate}`. Every tab or date change exits the old content (`y -8`, 0.18 s), then enters the new content (`y 8`, 0.18 s). While the old content exits, the new content is withheld.

**Evidence:** After clicking "Month to date", the old heading text was still present at t≈5 ms and the new headings appeared at t≈225 ms. The exit plus enter is ~220 ms before readable data, before the charts' own 0.25–0.55 s growth begins.

**Impact:** A report is a data view. Moving it vertically on every tab or date change makes reading feel unsteady, and the wait compounds with the chart animation. Users changing the report date can trigger this sequence repeatedly. This is animation for the transition's sake rather than for comprehension.

**Correction:** Use a fast opacity-only crossfade (150–180 ms) with `mode="wait"` or no wait, and no `y` movement. Do not include the loading state in the keyed transition if it causes a spinner-to-content double swap. The page shell already supplies the route entrance; Reports should not add a second movement.

---

#### M3. Bar chart stagger exceeds the interaction budget

**Location:** `apps/client/src/components/charts/ValueBars.tsx:47–52`

**Mechanism:** `duration: 0.25`, `delay: Math.min(index * 0.03, 0.3)`. With 11 monthly bars the last bar starts at 300 ms and finishes at 550 ms. Add the Reports tab transition (M2) and the chart is still settling ~730 ms after the click. The 30 ms gap is also below the 30–80 ms threshold at which a stagger reads as a sequence, and past 10 bars the `min(..., 0.3)` cap makes every remaining bar start together, so a 31-day month has no wave at all.

**Impact:** The chart feels slower than the rest of the app while failing to produce the sequence the stagger was meant to create. The stagger is decorative; it does not explain the data. On a report switch, users are waiting for values they already asked to see.

**Correction:** Choose one: no stagger with a single 180–200 ms grow, or a 50–60 ms stagger capped at 250 ms. Animate only when a report view first mounts, not on every date-filter refresh. Skip the growth entirely under reduced motion (already done).

---

#### M4. Feedback lifecycle is incomplete: entry-only animation, late live region, reset timer

**Location:** `apps/client/src/components/ui/StatusNote.tsx:11–30`, `apps/client/src/components/ui/Input.tsx:28–43`, `apps/client/src/lib/useStatusNote.ts:7–19`

**Mechanism:** Three related gaps:

1. **No exit.** Both messages use `motion.p` with `initial`/`animate` but no `exit`, and neither is inside `AnimatePresence`. StatusNote is conditionally rendered by its parent when the message clears after 4 s, so it disappears in one frame. Field errors disappear the same way when validation passes; the hint is not animated at all, so the field height jumps when the error/hint swap happens.
2. **Live region inserted already full.** `role="status"` exists only while a message exists, so the node mounts with its text instead of being updated. Several screen reader/browser pairs do not announce content that is present at insertion.
3. **Timer and replay.** `useStatusNote` returns a fresh `clear` closure each render, and `StatusNote`'s 4 s timer depends on `onDone`, so any parent re-render restarts the countdown. The nonce is also not passed to `StatusNote` and the `motion.p` has no key, so repeating the same message updates text without replaying the entrance.

**Impact:** Confirmation and error feedback has an entrance but no exit, which is the most noticeable kind of incomplete motion language. StatusNote vanishing abruptly after 4 s is a hard cut on a calm interface. Screen readers may miss the message entirely, and the toast can outlive its intended 4 s on a page that re-renders. Repeating the same confirmation can go unnoticed.

**Correction:** Wrap both in `AnimatePresence` with a 120–150 ms opacity-only exit (or use `@starting-style`), and animate the hint/error slot as one enter/exit pair. Keep one empty live region mounted and swap its text. Key StatusNote by the nonce/message so repeats replay, and `useCallback` the `clear` function (or keep `onDone` in a ref) so the timer is not reset by unrelated renders. Keep the error announcement (`role="alert"`) immediate.

---

#### M5. Page arrivals are inconsistent across the app

**Location:** `apps/client/src/pages/DashboardPage.tsx:135–139` vs `:208–258`; `apps/client/src/components/layout/AuthLayout.tsx:16–31`

**Mechanism:** AppLayout animates every authenticated page shell. Dashboard additionally animates only its first card; the other two cards are static. Login/Register have no entrance at all. Landing has a three-block entrance. So four page types have four different arrival behaviours.

**Impact:** The product does not have a single answer to "how does a page appear?" The Dashboard's one animated card is the most visible symptom (H1); the auth pages feel like a different app on first load.

**Correction:** One rule: the shell/page fades and rises once (250 ms, 8–10 px), and child cards do not animate on mount. Auth pages get the same 200–250 ms opacity-only or opacity+4 px entrance (they have no AppLayout). Remove the Dashboard card wrapper. Do not stagger dashboard cards.

---

#### M6. Chart motion is inconsistent within the same report view

**Location:** `ValueBars.tsx:47–63`, `SlotDonutChart.tsx:52–107`, `GlucoseTrendChart.tsx:90–136`

**Mechanism:** ValueBars grows and fades its average line. The donut and trend chart mount with no motion at all. They are rendered together in the same Cards in `ReportsPage.tsx:209–239` and `299–328`.

**Impact:** One chart performs an entrance while its neighbours pop in, which draws attention to the bars for the wrong reason and makes the card group feel assembled from different products. The continuous trend line is also the chart most likely to benefit from a brief reveal, but adding a third animation is not the answer.

**Correction:** Pick one deliberate behaviour for the group. Recommended: the report content fades in as a unit (M2), and only ValueBars keeps a shortened grow (M3) because it encodes magnitude from a baseline. Leave the donut and trend static — they are categorical/continuous and gain nothing from a second reveal. Document that exception in the motion system.

---

#### M7. Loading states are inconsistent: unlabeled spinners, a remounting status, and date-change flashes

**Location:** `apps/client/src/pages/DashboardPage.tsx:91–97`, `apps/client/src/pages/ReadingsPage.tsx:110–118, 131–135`, `apps/client/src/components/ui/Button.tsx:51–53`, `apps/client/src/pages/ReportsPage.tsx:139`

**Mechanism:** Three different loading languages:

- **Dashboard/Readings:** the standalone spinner is an `aria-hidden` SVG inside a plain `<div className="flex justify-center py-16">`. There is no `role="status"`, no `aria-label`, and no visible or screen-reader text.
- **Reports:** uses `role="status" aria-label="Loading report"` correctly, but the status node lives inside the keyed `motion.div`; if a tab/date change happens while it is loading, the node remounts and can be announced again. The panel itself has no `aria-busy`.
- **Readings date filter:** `onChange` sets `result` to `null` (lines 110–118), so every date selection replaces the whole list with the bare spinner, even when the previous result is still useful.

Under reduced motion the CSS rule (H3) freezes the spinner, leaving a static partial ring.

**Impact:** Screen-reader users get no announcement on two of the three loading surfaces and an inconsistent one on the third. Reduced-motion users get an ambiguous frozen arc. The Readings date filter flashes the page to a spinner for a query that may return quickly.

**Correction:** Create one shared loading pattern: `role="status"` with a visually hidden or visible "Loading…", `aria-busy` on the region being replaced, and a legible indicator under reduced motion. On Readings, keep the card/filter visible and mark only the list region busy instead of nulling the whole result. Use the same pattern in buttons (`aria-busy` already exists) and keep `aria-hidden` only on the decorative SVG.

---

### Low (7)

#### L1. Hover motion is not gated to hover-capable pointers

**Location:** `Button.tsx:43`, `AppLayout.tsx:42–46`, `ReadingsList.tsx:34, 42`, `ValueBars.tsx:52`, `GlucoseTrendChart.tsx:121`

**Mechanism:** `hover:` colour/background changes and `active:scale-[0.98]` are unconditional. Touch browsers can apply a hover state on tap and leave it stuck until the next tap.

**Impact:** Minor on this app because the hover effects are colour-only and the press scale is small, but it is a consistency and touch-polish gap.

**Correction:** Wrap hover-only transforms in `@media (hover: hover) and (pointer: fine)` where the effect matters. Colour hovers can stay unconditional; the press scale is already safe. Do not add hover lifts to cards.

---

#### L2. Dialog uses the same duration for entry and exit, and the reduced branch has no curve

**Location:** `Dialog.tsx:42–44, 66–69`

**Mechanism:** Entry and exit share `{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }`. The reduced-motion branch is `{ duration: 0.15 }` with no `ease`, so it falls back to Motion's default while the normal branch uses the house curve.

**Impact:** The close feels slightly slower than it needs to, and the reduced-motion path is the one place where the easing vocabulary changes without a reason. Standard guidance is exit faster than entry.

**Correction:** Use ~200 ms in and ~150 ms out, both with the shared ease (the reduced branch is opacity-only, so it can use the same curve). Focus restoration is covered in H5.

---

#### L3. Chart tooltip uses `role="tooltip"` inside a button without `aria-describedby`

**Location:** `GlucoseTrendChart.tsx:112–135`

**Mechanism:** Each point is a `<button>` with a complete `aria-label`; the visual tooltip inside it also has `role="tooltip"` but is not referenced by the button. The tooltip is redundant for screen readers and its `hidden`/`block` display toggle has no motion (which is fine for a tooltip).

**Impact:** Screen readers may announce the tooltip content twice or expose an unreferenced tooltip role. This is an accessibility polish issue, not a motion issue.

**Correction:** Keep the button's `aria-label` as the accessible description and remove `role="tooltip"` from the visual span, or give the span an id and reference it with `aria-describedby` while keeping the button label concise. Keep tooltips instant; do not add a fade.

---

#### L4. `AnimatePresence` children in the readings dialogs are unkeyed

**Location:** `useReadingDialogs.tsx:78–82`

**Mechanism:** The two conditional custom components (`ReadingFormDialog`, `DeleteReadingDialog`) are direct children of `AnimatePresence` without explicit keys. Identity currently works because the two positions are stable, but it relies on position rather than explicit identity.

**Impact:** No current visible bug. If a future flow swaps one dialog for the other in the same commit, AnimatePresence can mis-identify them and skip or merge exits.

**Correction:** Give each child an explicit key (`"reading-form"`, `"delete-reading"`). No other change.

---

#### L5. Landing keeps its stair-step delays under reduced motion

**Location:** `LandingPage.tsx:100–103, 192–195`

**Mechanism:** The reduced-motion branch removes `y` but keeps `delay: 0.07` and `delay: 0.14`. Three staged fades are still choreography, even without translation.

**Impact:** Reduced-motion users still wait through a 440 ms sequence to see the full landing page. The movement is gone, but the pacing is not reduced.

**Correction:** Under `reduceMotion`, set both delays to 0 (or use a single opacity fade for the whole content block). This is the "fewer and gentler" rule, not "zero motion".

---

#### L6. The report tablist lacks tabpanel semantics and roving focus

**Location:** `ReportsPage.tsx:108–127`

**Mechanism:** The buttons have `role="tab"` and `aria-selected`, but there is no `role="tabpanel"`, no `aria-controls`, no `aria-labelledby`, and no roving `tabIndex`/arrow-key handling. Keyboard users Tab through all three tabs instead of moving with arrows.

**Impact:** The tabs look like tabs visually but do not behave like a tab widget to assistive technology. This is adjacent to the animation audit (keyboard navigation during transitions) and cheap to fix.

**Correction:** Add a `tabpanel` wrapper tied to each tab, or drop the ARIA tab roles and present them as a group of toggle buttons. If keeping tabs, implement arrow-key movement and roving `tabIndex`.

---

#### L7. Reading mutations swap the list without an exit

**Location:** `ReadingsList.tsx:56–82`, `ReadingsPage.tsx:82–85`, `DashboardPage.tsx:86–89`

**Mechanism:** A successful add/edit/delete refreshes the data and re-renders the list. The old row disappears in one frame; the StatusNote is the only feedback. There is no `AnimatePresence` or layout animation.

**Impact:** The list jump is noticeable on delete but defensible in a calm data log — instant is often better than a row collapsing under the pointer. Treat this as optional polish, not a defect.

**Correction:** If changed at all, use a 120–150 ms opacity fade on the affected row and no `layout` animation. Do not add a page-level list stagger. Leaving it instant is acceptable.

---

## D. Aceternity UI review

**Conclusion: there are no Aceternity UI components in this repository.**

Evidence:

- `apps/client/package.json` dependencies: `motion`, `react`, `react-dom`, `react-router-dom` only. No `aceternity`, no `@aceternity/*`, no `clsx`/`tailwind-merge`-style support packages added for it.
- `package-lock.json`: no Aceternity entry. The only related entry is `framer-motion`, which `motion` depends on/aliases; it is not an Aceternity package.
- `apps/client/src`: no import, component name, or effect name matching Aceternity patterns (spotlight, meteor, aurora, beams, moving border, lamp, vortex, sparkles, shimmer, etc.). The only custom visual is the authored `BrandMark` SVG in `icons.tsx`.
- `git log --all -S"aceternity"` returns nothing. There is no removed Aceternity history either.

Therefore:

| Review question | Answer |
|---|---|
| What visual effect does each Aceternity component provide? | N/A — none present. |
| Does it have built-in animation? | N/A. |
| Does it also use Motion or custom CSS? | N/A. |
| Are animations duplicated? | N/A. The duplicate entrance that does exist is AppLayout + Dashboard (H1), not Aceternity. |
| Does it fit the SWEETy design system? | N/A. |
| Is the effect appropriate? | N/A. |
| Performance/accessibility concerns? | N/A. |

**What this means:** the brief's premise ("currently uses Motion / Framer Motion and Aceternity UI components") is not true for this checkout. Either the work is on another branch/project, or Aceternity was planned but never installed. Do not add it as part of this audit. If it is added later, the deliberate rules should be: one animation layer per element (never Aceternity motion + Motion on the same node), no decorative glow/background movement on data screens, no pointer-following effects in the app shell, and a reduced-motion path built in from the start.

---

## E. Motion / Framer Motion review

### What is used

| File | API | Purpose |
|---|---|---|
| `AppLayout.tsx` | `motion.div`, `useReducedMotion` | Route page entrance |
| `DashboardPage.tsx` | `motion.div` | Nested card entrance |
| `LandingPage.tsx` | `motion.div` ×3, `useReducedMotion` | Marketing stagger |
| `ReportsPage.tsx` | `motion.div`, `AnimatePresence`, `useReducedMotion` | Report panel swap |
| `Dialog.tsx` | `motion.div` ×2, `useReducedMotion` | Overlay + panel |
| `Input.tsx` | `motion.p`, `useReducedMotion` | Field error entrance |
| `StatusNote.tsx` | `motion.p`, `useReducedMotion` | Confirmation entrance |
| `ValueBars.tsx` | `motion.div` ×2, `useReducedMotion` | Bar growth + average line |
| `useReadingDialogs.tsx` | `AnimatePresence` | Dialog mount/unmount |

### Values observed

| Token | Values in use | Assessment |
|---|---|---|
| Durations | 150 ms, 180 ms, 200 ms, 250 ms, 300 ms | A sensible five-step scale, but not named or shared. Keep the scale; name it. |
| Enter/exit easing | `[0.23, 1, 0.32, 1]` (7 uses), `[0.42, 0, 1, 1]` (3 landing uses) | The house curve is right. Landing is wrong (H4). |
| Delays | 0, 50 ms, 70 ms, 140 ms; bar stagger 30 ms per item, capped 300 ms | Page/card delays are the problem (H1); bar total is too long (M3). |
| Springs | None | Correct. There is no justified use — no drag, sheet, or interruptible gesture. |
| Layout animations | None | Correct. No `layout`/`layoutId`, so no main-thread layout animation cost. |
| Scroll / in-view | None | Correct. No scroll reveals or retriggering. |
| Gestures | None | N/A. |
| Variants | None | The main consolidation opportunity. |
| `AnimatePresence` | Reports (with `mode="wait"`), dialogs (no mode) | Reports is too slow and moves data (M2); StatusNote/Field errors are missing it (M4). |
| `MotionConfig` | None | Missing safety net for reduced motion (H2). |

### Positive patterns to preserve

- **Transform/opacity only** for all scroll/mount motion. No width, height, margin, padding, top, or left is animated.
- **No `transition: all`.** CSS lists exact properties: background, border, colour, transform.
- **No springs and no bounce.** This matches the calm SWEETy identity.
- **No background movement, glow, parallax, or constant loops.** The only infinite animation is the functional spinner.
- **No layout animations.** No `layout`/`layoutId`, so no layout thrash or flicker.
- **No scroll listeners or IntersectionObservers**, so no retriggering or offscreen work.
- **`motion/react` is used consistently** and version 14.13 means `x`/`y`/`scale` shorthands are hardware-accelerated on HTML elements.
- **Reduced motion is handled in 7 of 8 Motion surfaces.** The pattern is sound; only Dashboard missed it.
- **Focus is moved into the dialog and restoration is attempted.** The missing pieces are containment and a stable restore target (H5), not initial focus.
- **Cards themselves have no hover lift.** That restraint is correct for a personal health log.

### Duplication and shared-config opportunity

The same transition ingredients are written across eight surfaces. The right consolidation is small:

- one `EASE.out` constant;
- one duration scale (`fast` 0.15, `base` 0.2, `page` 0.25, `marketing` 0.3);
- four transitions (`fast`, `base`, `page`, `marketing`);
- four variants (`page`, `fade`, `dialog`, `stagger`);
- no spring preset until a gesture exists.

Do **not** put every component on the same variant. A modal, a status note, a page, and a chart bar serve different purposes; the system should standardise the ingredients, not erase the distinctions.

---

## F. Performance and accessibility

### Performance

**Good:**

- All Motion animations use transform and/or opacity. No layout-triggering properties are animated.
- CSS transitions are limited to colour, border-colour, and transform.
- No animated blur, drop-shadow, or filter.
- No scroll handlers, no `IntersectionObserver`, no rAF loops, no `setState` per frame.
- No `will-change` is set, which is correct at rest; none is needed for these short, small-surface animations.
- Motion 14.13 accelerates independent `x`/`y`/`scale` transforms on HTML elements; the app already uses this version.
- The animated surfaces are small (page wrapper, one card, dialog panel, bars) rather than full-page filters or canvases.

**Budget concerns:**

- The reports sequence is the only place that exceeds the UI budget: 180 ms exit + 180 ms enter + 250 ms bar growth + up to 300 ms stagger ≈ 730 ms before the last bar settles (M2, M3). This is not a frame-rate problem; it is perceived latency.
- The Dashboard second wave is also perceived latency, not dropped frames (H1).
- The spinner uses a 1 s linear rotation. That is fine; the problem is its reduced-motion freeze, not its cost.
- The header uses `backdrop-blur-sm`, but it is static (not animated), so it does not create a per-frame filter cost. Keep it static.

**Not measured:** real-device frame timing on a mid-range phone, Safari/Firefox compositing differences, and long-task interaction during data fetches. The animations are small and transform-only, so the risk is low, but section I records the limit.

### Accessibility

| Check | Status | Evidence / finding |
|---|---|---|
| `prefers-reduced-motion` respected by Motion | **Partial** | 7 of 8 surfaces branch; Dashboard does not (H2). |
| Reduced-motion alternative preserves meaning | **Partial** | Opacity-only fades remain; good. But the CSS global rule also removes useful feedback and freezes the spinner (H3). |
| Essential content not hidden behind animation | Pass | No content is gated on animation completion; `animate` starts immediately and children render. |
| Animations do not block interaction | Pass | No pointer-events changes during entrances; dialogs are interactive immediately. |
| Keyboard navigation during transitions | **Fail at the modal boundary** | Tab escapes the dialog into the page (H5). |
| Focus moved into dialog | Pass | `panelRef.current?.focus()` on open. |
| Focus restored on close | **Fail in the delete flow** | The effect depends on an inline `onClose`, so each render re-saves the active element; after a successful delete it can restore to a removed button and drop focus to `<body>` (H5). |
| Live feedback announced | **Partial** | `role="status"` mounts only when a message exists, so some screen readers miss it; the toast timer resets on parent renders (M4). |
| Loading state announced | **Partial** | Reports has `role="status"`; Dashboard/Readings do not (M7). |
| Loading indicator legible under reduced motion | **Fail** | Spinner freezes into a static arc (H3/M7). |
| Tooltip accessible by keyboard | Pass | Points are buttons with `group-focus`; tooltip content is duplicated in `aria-label` (L3 for the redundant role). |
| Hover-only information | Pass | All hover affordances have focus equivalents or are decorative; no essential hover-only content. |
| Touch hover behaviour | **Partial** | Hover styles are not pointer-gated (L1). |
| Contrast / colour | Pass | Palette tokens are used; the cream/olive system is consistent. Not re-audited here beyond motion. |
| Auto-dismiss timing | **Partial** | `StatusNote` clears after 4 s with no pause; acceptable for a confirmation, but it should fade out (M4). |

---

## G. Recommended motion design system

### Principles

1. **One page arrival.** The shell owns it; child cards do not repeat it.
2. **Short and decelerating.** 150–250 ms for UI; 300 ms only for the landing/marketing entrance. One strong ease-out curve.
3. **No springs, no bounce, no parallax, no background loops.** There is no gesture or draggable surface that justifies them. Add a spring only when a real drag/sheet interaction exists.
4. **Colour and press feedback stay in CSS.** Motion is for mount/exit and orchestration, not for hover colours.
5. **Reduced motion removes movement, not meaning.** Opacity and colour stay; the loading label stays; content never becomes invisible or static-ambiguous.
6. **Animate the group, not every card.** One container fade is calmer and cheaper than staggered cards.

### Tokens

Add one file: `apps/client/src/lib/motion.ts`.

```ts
import type { Transition, Variants } from 'motion/react';

// Seconds, matching the existing scale. Do not add more steps.
export const DURATION = {
  fast: 0.15, // hover-adjacent feedback, status/error, dialog exit
  base: 0.2, // dialogs, tab/report swaps
  page: 0.25, // route entrance
  marketing: 0.3, // landing only
} as const;

// One entrance/exit curve. No ease-in anywhere.
export const EASE = {
  out: [0.23, 1, 0.32, 1],
} as const;

export const TRANSITION = {
  fast: { duration: DURATION.fast, ease: EASE.out },
  base: { duration: DURATION.base, ease: EASE.out },
  page: { duration: DURATION.page, ease: EASE.out },
  marketing: { duration: DURATION.marketing, ease: EASE.out },
} satisfies Record<string, Transition>;

export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const dialogPanel: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.97 },
};

// Only where a real list appears as a list. Cap the total, not just each delay.
export const listStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0 } },
};
```

**No spring preset.** If a drawer or drag-to-dismiss is added later, the justified default is `{ type: 'spring', duration: 0.5, bounce: 0.2 }`; do not add it now.

**CSS mirror (optional, only if CSS transitions need the house curve):**

```css
@theme {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}
```

Current CSS transitions are colour/border feedback, where the platform `ease` is appropriate. Do not force the entrance curve onto hover colours.

### Reduced-motion strategy

Use both layers deliberately:

1. **Root safety net:** wrap the app in `<MotionConfig reducedMotion="user">` in `main.tsx` or `App.tsx`. This makes every Motion component respect the OS preference by default, even if a future component forgets `useReducedMotion`.
2. **Explicit branches where they matter:** keep the opacity-only `useReducedMotion` branches for page, dialog, landing, error, and status. They document intent and are already correct.
3. **Replace the global CSS kill switch** with a targeted rule that removes movement but keeps opacity/colour:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation-duration: 2s; /* keep a legible loading indicator */
  }
  /* Remove only movement classes, not every transition in the app. */
}
```

If a global rule is desired, use `scroll-behavior: auto` and `animation-iteration-count: 1` only for decorative loops, not `transition-duration: 0.01ms` on `*`. Keep the confirmation/error fades.

4. **Loading text always exists** for assistive tech, independent of animation:
   `<div role="status"><Spinner aria-hidden /><span className="sr-only">Loading…</span></div>`.

### Reusable variants

| Variant | Use | Hidden → visible | Exit | Duration |
|---|---|---|---|---|
| `pageEnter` | App shell route wrapper; AuthLayout page wrapper | `opacity 0, y 8` → `opacity 1, y 0` | none (route swap) | 250 ms |
| `fade` | StatusNote, field errors, report content, reduced-motion fallback | `opacity 0` → `1` | `opacity 0` | 150–180 ms |
| `dialogPanel` | Dialog panel only | `opacity 0, y 8, scale 0.97` → `1, 0, 1` | reverse | 200 ms in / 150 ms out |
| `listStagger` | Only if a real list needs it (not dashboard cards) | children `opacity 0, y 4` → `1, 0` | none | 150 ms, 40 ms stagger, total ≤ 200 ms |

Overlay: opacity only, `base` transition. Do not slide the overlay.

### Per-component behaviour

| Component | Behaviour |
|---|---|
| **Navigation** | No per-link animation. Colour transition 150 ms. Active state is an immediate background change, not a sliding indicator. Page entrance is owned by the shell: 250 ms, `y 8→0`. |
| **Buttons** | CSS only: background/border/colour 150 ms, `active:scale-[0.98]` 150 ms. No hover lift, no Motion, no bounce. Loading: spinner + `aria-busy` + visible/hidden "Loading…". |
| **Cards** | Static surfaces. No hover transform. No individual card entrance. A card may fade 150 ms when its content is replaced, but not rise. |
| **Forms** | Input focus: border + ring, 150 ms. Errors: `fade` 150 ms in and out via `AnimatePresence`; no shake, no colour flash. Keep `role="alert"`. |
| **Modals** | Overlay opacity 200 ms. Panel `dialogPanel` 200 ms in, 150 ms out. Focus trap/inert background. Focus restore after close. Reduced motion: opacity only. |
| **Dropdowns/popovers** | None exist. If added: 150–200 ms, opacity + `scale 0.97` from the trigger origin (modal exempt, stays centred). No bounce. |
| **Tabs** | Tab colour 150 ms. Content: opacity-only crossfade 150–180 ms; no vertical movement; do not re-run on each date keystroke. |
| **Charts** | One behaviour for the group. Recommended: report content fades in; ValueBars keeps a single 180 ms grow with no stagger (or ≤100 ms total); donut and trend stay static. No animation on data refresh after the first view. |
| **Loading** | Spinner 1 s linear; always paired with `role="status"` + "Loading…". Under reduced motion, keep a legible static/slow indicator and the text. |
| **Empty states** | Appear with the page/content fade; no separate animation. No looping illustration or pulsing placeholder. |
| **Errors** | Immediate `role="alert"`; optional 150 ms fade-in. Never auto-dismiss an error. |
| **Landing** | Three blocks, 300 ms house ease-out, delays 0 / 50–70 ms / 100–140 ms. Header/footer static. Replay on reload is acceptable. |
| **Status confirmations** | 150 ms fade in, 150 ms fade out, auto-dismiss after 4 s. Key by message/nonce so repeats re-animate. |
| **Dashboard** | No local entrance. Shell entrance only. Do not stagger the lower cards. |
| **Auth pages** | Same shell-level 250 ms fade/4–8 px rise as the app, or fade only. Do not leave them static while the rest animate. |

### What not to add

- No scroll-reveal library or `whileInView`.
- No stagger on dashboard cards, list rows, or nav.
- No page-wide crossfade that delays the new route behind an exit.
- No hover Motion on cards or nav.
- No spring/bounce on dialogs or tabs.
- No Aceternity decorative effects unless a specific product need is approved; if added, one animation layer only.

---

## H. Prioritized remediation roadmap

### Phase 1 — Fix broken/conflicting animation (highest value, smallest diff)

| # | Change | Files | Expected impact |
|---|---|---|---|
| 1.1 | Remove the Dashboard card's nested `motion.div`; let AppLayout own the page entrance. | `DashboardPage.tsx:135–139, 206` | Eliminates H1; one arrival, no second wave. |
| 1.2 | Add `useReducedMotion` opacity branch to Dashboard **and** `<MotionConfig reducedMotion="user">` at the root. | `DashboardPage.tsx`, `main.tsx` or `App.tsx` | Fixes H2 and prevents recurrence. |
| 1.3 | Change landing easing from `[0.42, 0, 1, 1]` to `[0.23, 1, 0.32, 1]`. | `LandingPage.tsx:79, 103, 195` | Fixes H4; landing matches the app. |
| 1.4 | Trap focus in the dialog (`inert` app root or Tab loop), make `onClose` stable, and use a mount-only focus effect. | `Dialog.tsx`, `useReadingDialogs.tsx:64–70` | Fixes H5; modal keyboard behaviour becomes correct and focus survives a delete. |
| 1.5 | Replace the global reduced-motion kill switch with targeted rules; keep the spinner legible; add `role="status"` + "Loading…" to Dashboard/Readings. | `index.css:45–53`, `DashboardPage.tsx:91–97`, `ReadingsPage.tsx:131–135` | Fixes H3/M7; reduced motion keeps meaning and feedback. |
| 1.6 | Set `loading` and clear the period state at the start of the Reports effect (or render only data matching the current request key). | `ReportsPage.tsx:51–92` | Fixes H6; the new tab cannot show the previous period's numbers. |

**Verification:** fresh `/today` has one entrance; reduced-motion emulation shows no translate on the card; landing uses the house curve; Tab never leaves the dialog; reduced-motion spinner still communicates loading.

### Phase 2 — Standardize timing and easing

| # | Change | Files | Expected impact |
|---|---|---|---|
| 2.1 | Add `motion.ts` with `DURATION`, `EASE`, `TRANSITION`, and the four variants from section G. | new `apps/client/src/lib/motion.ts` | Single source of truth (M1). |
| 2.2 | Migrate AppLayout, Landing, Dialog, Input, StatusNote, ValueBars, Reports to the tokens. | the eight Motion files | Removes copied values and future drift. |
| 2.3 | Make Reports a 150–180 ms opacity-only crossfade; remove `y ±8`; reconsider including loading in the keyed swap. | `ReportsPage.tsx:130–136` | Fixes M2; report data stops moving and arrives sooner. |
| 2.4 | Shorten bar growth: 180 ms, no stagger, or a 20 ms stagger capped at 100 ms. Animate only on first report view. | `ValueBars.tsx:47–52` | Fixes M3; report switch settles quickly. |

**Verification:** all entrances use one curve; no UI sequence exceeds ~300 ms except the intentional landing wave; Reports content is readable immediately.

### Phase 3 — Consolidate reusable Motion variants

| # | Change | Files | Expected impact |
|---|---|---|---|
| 3.1 | Replace the inline page entrance in AppLayout with `pageEnter` + `TRANSITION.page`. | `AppLayout.tsx:71–78` | One page variant. |
| 3.2 | Replace landing blocks with the same `pageEnter` variant and a 50–70 ms stagger. | `LandingPage.tsx:76–195` | Landing and app share a language without sharing a duration. |
| 3.3 | Replace Dialog panel/overlay with `dialogPanel`/opacity and asymmetric in/out. | `Dialog.tsx` | Consistent modal motion and faster close (L2). |
| 3.4 | Add `AnimatePresence` + `fade` exit to StatusNote and Field errors; key StatusNote by message/nonce. | `StatusNote.tsx`, `Input.tsx`, `useStatusNote.ts` | Fixes M4/L5; feedback appears and leaves intentionally. |
| 3.5 | Add explicit keys to the two `AnimatePresence` dialog children. | `useReadingDialogs.tsx:78–82` | Removes positional identity risk (L4). |

**Verification:** grep shows no inline `[0.23, 1, 0.32, 1]` outside `motion.ts`; every Motion surface uses a named transition; status/error exits are visible.

### Phase 4 — Refine Aceternity integration

There is nothing to refactor today (section D). The only action is a product decision:

- If Aceternity was intended, choose components deliberately, add them one at a time, and check each against the rules in section D (one animation layer, no decorative data-screen movement, reduced motion, no glow/neon).
- If not, record that the app does not use Aceternity and remove the assumption from project documentation so future audits do not chase it.

**Do not** add Aceternity as part of this remediation.

### Phase 5 — Accessibility and performance hardening

| # | Change | Files | Expected impact |
|---|---|---|---|
| 5.1 | Scope CSS reduced-motion rules; keep opacity/colour transitions; keep a legible spinner. | `index.css` | Fixes the over-reduction side of H3. |
| 5.2 | Add `role="status"` + visible/hidden loading text to every standalone spinner. | Dashboard, Readings, any future spinner | Fixes M7; screen readers hear progress. |
| 5.3 | Pointer-gate hover transforms; leave colour hovers. | `Button.tsx`, `ValueBars.tsx`, nav/list links | Fixes L1. |
| 5.4 | Remove the redundant `role="tooltip"` or wire `aria-describedby`; keep tooltips instant. | `GlucoseTrendChart.tsx:123–134` | Fixes L3. |
| 5.5 | Confirm no layout properties, no scroll listeners, no per-frame state; keep `will-change` off until measured. | all Motion files | Preserves the current good performance profile. |

**Verification:** reduced-motion pass on every route; screen-reader loading announcements; touch hover check; Lighthouse/React Profiler shows no new work during animation.

### Phase 6 — Final visual polish

| # | Change | Files | Expected impact |
|---|---|---|---|
| 6.1 | Give Login/Register one shell-level fade entrance so all four page types arrive consistently. | `AuthLayout.tsx`, auth pages | Fixes M5. |
| 6.2 | Decide the chart group behaviour and document the exception (bars only, or none). | Reports, charts | Fixes M6 and prevents a third chart animation. |
| 6.3 | Feel-check at 2–5× duration in DevTools; verify dialog close, status exit, report tab, and landing wave. | browser | Catches timing that source inspection cannot. |
| 6.4 | Re-capture desktop/mobile screenshots and compare against the current calm baseline. | `docs/screenshots` | Confirms the identity is unchanged. |

**Definition of done for remediation:** one token file; no inline house-curve literals; no nested page/card entrances; reduced motion respected in Motion and CSS without freezing feedback; modal focus contained and restored to a live element; loading states announced; no report tab ever shows another period's numbers; report switches readable in under 300 ms; no springs, bounce, parallax, or decorative loops added.

---

## I. Verification limitations

### What was verified from source

- Every file under `apps/client/src` that can affect motion: all pages, layouts, shared UI components, readings components, charts, `index.css`, `main.tsx`, `App.tsx`.
- `apps/client/package.json`, root `package.json`, `package-lock.json`, `vite.config.ts`, `index.html`.
- `plans/001-landing-entrance.md`, `plans/README.md`, relevant README animation sections, `docs/screenshots/README.md`.
- `git log --all -S"aceternity"` and the source/dependency search for Aceternity.
- The installed animation skills: `review-animations` + `STANDARDS.md`, `animation-vocabulary`, `animation-performance`, `choreograph`, `improve-animations` + `AUDIT.md`, `find-animation-opportunities`, `gestures`, `emil-design-eng`, `impeccable` (`SKILL.md`, `reference/audit.md`, `reference/animate.md`), and the `animation-specialist` subagent.

### What was verified in a browser

Chrome 156 headless with the DevTools Protocol, against the Docker dev client already running at `http://localhost:5173`, logged in as `demo@sweety.local`:

- Screenshots at 1280×800: login, dashboard (normal and reduced), readings, reports daily, reports month-to-date, add-reading dialog.
- Screenshots at 390×844: dashboard, reports.
- Frame-by-frame computed `opacity` and `transform` sampling on a fresh `/today` load, normal and reduced motion.
- Emulated `prefers-reduced-motion: reduce`; computed `animation-duration`/`transition-duration` on a spinner and a transition probe.
- Keyboard Tab sequence through the open dialog (14 tabs) to verify focus containment.
- Reports tab switch timing by sampling heading text until the new view appeared.
- Network throttling (900 ms latency) on the Reports tab switch to confirm the stale-period window (H6).

The screenshots are in a temporary audit folder, not committed, because the only permitted output of this phase is this report.

### What was not verified

- **Perceptual feel at 60/120 Hz on real hardware.** Computed styles and screenshots cannot tell whether a 250 ms fade feels right or drops frames on a mid-range phone.
- **Frame timing / long tasks.** No DevTools Performance trace or CPU throttling was recorded. The animations are small and transform-only, so the risk is low, but it is not measured.
- **Safari and Firefox.** Only Chrome was exercised. Compositing, WAAPI acceleration, and reduced-motion behaviour can differ.
- **Screen reader announcements.** The focus sequence was measured, but no NVDA/VoiceOver session confirmed what is announced for loading, errors, or the dialog.
- **Real touch hardware.** Hover-gating and press feedback were reviewed in source, not on a physical touch device.
- **Dialog exit completion and the delete focus-restore race.** The dialog was opened, inspected, and closed with Escape; the destructive-delete path was not run, so H5's restore race is source-verified rather than observed on a real deletion. The 200 ms unmount sequence was not profiled across browsers.
- **Production build.** The running client is the Vite dev server. Minification and production timing were not compared.
- **Aceternity runtime behaviour.** There is nothing to run. The conclusion is source/dependency/history based, which is sufficient for "none present".

No Playwright/Puppeteer dependency was installed and no browser automation was added to the project. No application source, CSS, animation values, dependencies, lockfiles, or git history were modified.
