# 001 — Landing page entrance: staggered fade-and-rise on every load

- **Status**: TODO
- **Commit**: bad6d9a
- **Severity**: LOW (additive polish / missed opportunity, requested by the product owner)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (`apps/client/src/pages/LandingPage.tsx`), ~25 lines changed

## Problem

`apps/client/src/pages/LandingPage.tsx` mounts with zero motion-on-load: the header,
hero copy, product preview panel, features row and footer all appear at once, instantly.
The product owner has decided the landing should get a short entrance on first load and
on every reload.

Because the page remounts on every full load and on every SPA navigation back to `/`
(e.g. after logout), a mount entrance replays on every load automatically — no extra
mechanism is needed.

Current code (verbatim, `apps/client/src/pages/LandingPage.tsx`):

```tsx
// lines 1-4
import { Link, useNavigate } from 'react-router-dom';
import { ValueBars } from '../components/charts/ValueBars.js';
import { Button } from '../components/ui/Button.js';
import { BrandMark, PlusIcon } from '../components/ui/icons.js';

// lines 52-74
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <span className="text-lg font-semibold tracking-tight text-olive-dark">Sweety</span>
          </Link>
          <Link
            to="/login"
            className="flex min-h-11 items-center text-sm font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
```

```tsx
// line 94 — the preview panel (note: the className must be preserved verbatim)
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_48px_-24px_rgb(52_63_43/0.25)] sm:p-6">
```

```tsx
// the features row, further down the file
        <div className="mt-12 grid gap-8 border-t border-line pt-6 sm:grid-cols-3 sm:gap-10">
```

## Target

One entrance for the content: each of the three content blocks fades in while rising
12px, using the repo's house ease-out curve, with a 70ms stagger between blocks.
Header and footer stay static (quiet chrome). Total wave ≈ 300ms + 140ms delay ≈ 440ms.

Every animated element uses exactly:

- transform/opacity only: `y: 12 → 0`, `opacity: 0 → 1`
- ease: `cubic-bezier(0.23, 1, 0.32, 1)` (house ease; also the AUDIT `--ease-out` curve)
- duration: `0.3`
- stagger delays: hero copy `0`, preview panel `0.07`, features row `0.14`
- reduced motion: opacity only, no movement (fade in place)

Target JSX for each of the three blocks (only the element tag and motion props change;
`className` and children stay byte-identical):

```tsx
// hero copy block (was a plain <div> opening the left grid column)
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
```

```tsx
// preview panel block
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.07 }}
            className="rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_48px_-24px_rgb(52_63_43/0.25)] sm:p-6"
          >
```

```tsx
// features row block
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.14 }}
          className="mt-12 grid gap-8 border-t border-line pt-6 sm:grid-cols-3 sm:gap-10"
        >
```

Each `<motion.div>` closes with `</motion.div>` where the original block closed with
`</div>`.

## Repo conventions to follow

- Motion values live inline as props (there is no easing-token file in this repo). The
  house ease `[0.23, 1, 0.32, 1]` is used verbatim in `AppLayout.tsx:75` (0.25s),
  `Dialog.tsx:44` (0.2s), `Input.tsx:39` (0.15s), `ValueBars.tsx:19` (0.25s).
- The `useReducedMotion` opacity-only branch is the established pattern — exemplar,
  `apps/client/src/components/ui/Input.tsx` (the Field error):

```tsx
import { motion, useReducedMotion } from 'motion/react';
// ...
  const reduceMotion = useReducedMotion();
// ...
        <motion.p
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
```

- Import source is `motion/react` (motion@14.13.0; ≥ 14.2, so `y` shorthands are
  hardware-accelerated on HTML elements).
- Inline delay props are already used, e.g. `DashboardPage.tsx:138`
  (`transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.05 }}`).

## Steps

1. In `apps/client/src/pages/LandingPage.tsx`, add one import after line 1
   (`import { Link, useNavigate } from 'react-router-dom';`):

   ```tsx
   import { motion, useReducedMotion } from 'motion/react';
   ```

2. Inside `LandingPage()`, directly under `const navigate = useNavigate();`, add:

   ```tsx
   const reduceMotion = useReducedMotion();
   ```

3. Change the hero copy block's opening `<div>` (the one immediately after
   `<div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">`) to the
   hero-copy `<motion.div>` from Target, and its matching closing `</div>` (the one
   right before the preview panel block) to `</motion.div>`. Children (h1, p, CTA row)
   stay untouched.

4. Change the preview panel's opening `<div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_48px_-24px_rgb(52_63_43/0.25)] sm:p-6">`
   to the preview-panel `<motion.div>` from Target (className preserved exactly), and
   its matching closing `</div>` (right after the "Month to date" section's closing
   tag) to `</motion.div>`.

5. Change the features row's opening
   `<div className="mt-12 grid gap-8 border-t border-line pt-6 sm:grid-cols-3 sm:gap-10">`
   to the features-row `<motion.div>` from Target, and its matching closing `</div>`
   (right before `</main>`) to `</motion.div>`.

## Boundaries

- Do NOT touch any file other than `apps/client/src/pages/LandingPage.tsx`.
- Do NOT add motion to the `<header>`, the `<footer>`, or anything inside the preview
  panel (the demo `ValueBars` must stay static — it gets no `animate` prop).
- Do NOT change any className, text, or markup structure beyond div → motion.div.
- Do NOT add or update dependencies.
- Do NOT run `npm run format` (the repo's prettier runs in the harness pipeline; your
  output must already be prettier-clean — match the surrounding indentation exactly).
- Do NOT commit; leave the change in the working tree for review.
- If the code at any step does not match the excerpts above (drift since commit
  bad6d9a), STOP and report instead of improvising.

## Verification

- **Mechanical** (run from the repo root `/Users/mainaksen/projects/sweety`):
  - `npm run lint` → clean
  - `npm run typecheck` → clean
  - `npm test --workspace @sweety/client` → 21 passed (the landing smoke test must
    still find the headline and button — motion renders children immediately)
  - `npm run build --workspace @sweety/client` → ✓ built
- **Feel check** (performed by the reviewer in the live app at http://localhost:5173/):
  - Reload `/`: header and footer appear instantly; hero copy, then the preview panel
    (~70ms later), then the features row (~140ms later) fade in while rising ~12px,
    one coherent top-to-bottom wave, no bounce, no loop.
  - DevTools → Animations panel at 10% speed: the three blocks decelerate into place
    (fast start, soft landing), rise distance identical for all three.
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: blocks fade in
    with no vertical movement, stagger still present.
  - Navigate away and back (logout → landing): the entrance replays.
- **Done when**: gates green and the entrance reads as one staggered wave that replays
  on every reload with reduced-motion honored.
