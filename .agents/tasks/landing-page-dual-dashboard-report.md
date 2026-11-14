# Landing page — dual dashboard showcase

Date: 2026-11-14
Scope: `apps/client` marketing landing page
Status: implemented and verified; uncommitted

## 1. Architecture

The landing page remains a single public route (`/`) rendered by `LandingPage.tsx`. It is composed of:

- `LandingPage` — header, hero, showcase, two role sections, platform section, final CTA, footer.
- `DualDashboardShowcase` — the scroll-linked patient/doctor composition and its labels.
- `DashboardPreviews` — two static, non-authenticated preview windows.
- `SmoothScroll` — window-level Lenis lifecycle, mounted only around the landing page.
- `useMediaQuery` — `useSyncExternalStore` wrapper over `matchMedia` for the three transform tiers.

No backend, auth, permission, route or dashboard code was changed. The previews are presentational: they never fetch `/api/*`, never mount the authenticated dashboard pages, and their sample values live only in `DashboardPreviews.tsx`.

## 2. Reused components and design system

The previews deliberately reuse the real product language rather than a new mock design:

- `ValueBars` (`components/charts/ValueBars.tsx`) for both glucose charts.
- `ReadonlyPill` (`components/doctor/DoctorUi.tsx`) for the doctor window badge.
- `BrandMark`, `PersonIcon`, `StethoscopeIcon`, `MailIcon`, `UsersIcon`, `ArrowRightIcon` from `components/ui/icons.tsx`.
- Existing tokens only: `bg-cream`, `bg-surface`, `bg-sage`, `border-line`, `text-ink`, `text-ink-soft`, `text-olive`, `text-olive-dark`; existing type scale, radii and spacing patterns.
- Existing Motion conventions: `motion/react`, cubic-bezier `[0.23, 1, 0.32, 1]`, 300 ms entrances, `useReducedMotion`.

New code is limited to layout, illustration data and the media-query hook. The previews use the same four-reading model, daily/month-to-date report labels, assigned-patient list and read-only language that the authenticated pages implement.

## 3. Composition

Section order:

1. Header (brand, Sign in, Get started).
2. Hero — “Better glucose tracking. Better connected care.”, supporting copy, “Get started” and “Explore Sweety”, plus a desktop-only Patients / Doctors / Consent summary.
3. `#experiences` — dual dashboard showcase.
4. `#patients` — “Four readings a day, kept in one place” + four numbered steps.
5. `#doctors` — “The patients who invited you, read-only” + four numbered steps + read-only disclaimer.
6. Platform — “Consent is the connection” + five platform facts.
7. Final CTA — “Start with your next reading”.
8. Footer — “A personal log — not a medical device”.

The showcase is introduced by a hairline consent motif: `BrandMark` flanked by rules, captioned “Access starts with a patient's invitation”. Patient preview is the left column, doctor preview the right column, with labels above each card (icon + role + one-line promise). A visible caption below reads “Illustrative previews. Names and readings are examples.”

Both previews are marked `aria-hidden="true"` because they are decorative illustrations of the real product; the headings and prose carry the meaning.

## 4. Exact transforms and perspective

Desktop (`min-width: 1024px`):

- Container: `perspective: 2000px` (`lg:[perspective:2000px]`).
- Patient card: `rotateY(-30deg)` + `rotateZ(1.5deg)` at rest.
- Doctor card: `rotateY(30deg)` + `rotateZ(-1.5deg)` at rest.
- Total angle between planes: 60°.
- Scroll entry begins at `rotateY(∓58deg)`, settles to `∓30deg`, drifts to `∓36deg` near exit.
- Horizontal entry: `∓120px → 0`, then a 6px inward drift and 16px outward drift on exit.
- Vertical drift on exit: `0 → 14px`.
- Scale: constant 1 on desktop.
- Opacity: `0.3 → 0.72 → 1 → 1 → 0.94`.

Tablet (640–1023 px):

- Same 2000px perspective container, but rotations reduced to entry `∓24deg`, rest `∓10deg`, exit `∓16deg`.
- Horizontal entry reduced to `∓36px`.
- Scale `0.94 → 1 → 1 → 1 → 0.985`.
- Opacity `0.3 → 0.72 → 1 → 1 → 0.94`.

Mobile (<640 px):

- No `perspective`, no rotation, no horizontal movement.
- Cards stack in one column with 40px gap.
- Scale fixed at 1.
- Opacity `0.55 → 1` over `[0, 0.06, 0.42, 0.78, 1]`; the fade completes before the first tall card is centered in view.

Measured at 1440×900, scroll 800 px: patient card `x=231`, doctor `x=765`, each 443×663 px, gap 91 px, composition spans 231–1208 px inside 1440 px. The computed matrix resolves to ~30.2° rotation and ~1.5° lean, matching the source values. Measured at 834×1112, scroll 900 px: cards 374 px wide, gap 38 px, opacity 1, ~11.2° rotation (10° rest plus the beginning of the exit drift). No horizontal overflow.

Reduced motion keeps the finished desktop composition (`rotateY ±30°`, `rotateZ ±1.5°`, opacity 1) and removes all scroll movement.

## 5. Lenis

`lenis@^1.3.27` was not installed before this work; it was added to `@sweety/client` only. There is no other scroll smoother or Aceternity dependency in the project.

`SmoothScroll.tsx`:

- Creates exactly one `new Lenis({ lerp: 0.1, smoothWheel: true, anchors: true })`.
- Drives it with a single `requestAnimationFrame` loop.
- Cancels the frame and calls `lenis.destroy()` on unmount, so route changes cannot leave a second instance.
- Skips initialisation under `prefers-reduced-motion: reduce` and when `ResizeObserver` is unavailable; native scrolling remains.
- Uses the current v1.3 API (no deprecated `wrapper`/`content` options).
- Imports `lenis/dist/lenis.css` once.

Verified: `<html>` carries `lenis` at 1440, 834 and 390 px; it does not under reduced motion. Clicking “Explore Sweety” updates the hash, smooth-scrolls and settles `#experiences` at 24px from the viewport top, matching `scroll-mt-6`.

## 6. Motion and scroll choreography

- `useScroll({ target: stageRef, offset: ['start end', 'end start'] })` reads native scroll position, which Lenis updates; no duplicate scroll driver.
- One `scrollYProgress` feeds five keyframe ranges: `[0, 0.22, 0.42, 0.78, 1]`. Entry occupies the first 22%, the composition holds from 22–42%, and a restrained exit begins after 78%.
- Only `transform` and `opacity` are animated: `x`, `y`, `rotateY`, `rotateZ`, `scale`, `opacity`.
- Labels use `whileInView` with `once: true`, `amount: 0.5`, 300 ms and a 60 ms second-card delay.
- Hero copy uses the same 300 ms house curve; reduced motion collapses entrances to opacity only.
- All motion values are cleaned up by Motion on unmount; no manual listeners were added.

## 7. Aceternity-style effects

No Aceternity package or copy-pasted component was added. Two techniques were borrowed conceptually and implemented with local Tailwind classes:

- A faint 56px grid behind the cards, radially masked (`radial-gradient(ellipse at center, black 30%, transparent 72%)`) at 60% opacity, `aria-hidden`.
- The consent hairline with the brand droplet as the visual signature, rather than a generic glow or gradient headline.

The rest is intentionally restrained: no spotlight cards, beams, moving borders or gradient text. This matches the existing paper/olive product world.

## 8. Responsive behavior

| Tier | Layout | Rotation | Motion |
| --- | --- | --- | --- |
| Desktop ≥1024 | Two columns, 2000px perspective, 91px measured gap | ±30° | Full scroll entry/settle/exit |
| Tablet 640–1023 | Two columns, reduced perspective effect | ±10° rest | Reduced travel, scale 0.94→1 |
| Mobile <640 | One column, stacked | none | Opacity only |

Checks performed:

- 320×720: `scrollWidth === innerWidth === 320`, no horizontal overflow.
- 390×844: `scrollWidth === innerWidth === 390`; cards 358 px wide; patient at y=355 and doctor at y=1016 when scrolled 700 px; both reach opacity 1 while visible; no clipping.
- 834×1112 and 1440×900: no horizontal overflow.
- Reduced motion at 1440×900: static cards, opacity 1, page height 3687 px, no Lenis class.

The `overflow-x-clip` on the showcase section prevents the angled cards from creating a scrollbar without hiding vertical overflow.

## 9. Performance

- The showcase animates only transform and opacity; no width/height/top/left animations.
- `perspective` is applied per container, not per frame.
- One scroll-linked Motion value tree, one rAF loop from Lenis, no scroll listeners added manually.
- Previews are static DOM, not authenticated pages; no API calls, no data fetching, no images.
- Cards use one shadow each, no backdrop blur or large animated filters.
- `whileInView` is `once`, so label observers disconnect after the first intersection.
- Production bundle: `540.08 kB` JS (`163.82 kB` gzip), `39.05 kB` CSS (`7.77 kB` gzip). Vite still emits its >500 kB chunk warning; this is not new to this change but is a remaining cost, largely from the authenticated app and chart/Motion code that share the entry bundle.

## 10. Accessibility

- One `h1`; sections use `h2` with `aria-labelledby`; card labels use `h3`; no skipped levels in the new page.
- All CTAs are real links (`/register`, `/login`, `#experiences`) with visible text, keyboard reachable, and minimum 44–48px hit heights on the primary actions.
- Tab order verified: brand → Sign in → header Get started → hero Get started → Explore Sweety → patient CTA.
- The showcase section has `scroll-mt-6` so the anchor target is not hidden at the top edge.
- Previews are `aria-hidden`; their meaning is carried by the surrounding headings and prose.
- Reduced motion: Lenis is not created, hero entrances are opacity-only, showcase jumps to its final static composition. Verified with `reduced_motion="reduce"`.
- Color and type reuse existing tokens previously used across the app; this change introduces no new palette.

## 11. Tests and results

Commands run after the final edits:

```
npm run typecheck --workspace @sweety/client   # pass
npm run lint                                   # pass
npm test --workspace @sweety/client            # 13 files, 130 tests pass
npm run build --workspace @sweety/client       # pass, chunk warning only
```

Coverage added/updated:

- `LandingPage.test.tsx` asserts the `h1`, both role headings, the dual-showcase heading, the illustrative-data caption, both workflows, the consent boundary, the read-only disclaimer, `/login`, `/register` and the `#experiences` anchor.
- `App.test.tsx` was updated from the old landing copy to the new `h1` and link-based CTA.
- `setupTests.ts` gained a jsdom `IntersectionObserver` that reports immediate intersection, required by Motion's `whileInView`; without it the landing tests throw.

Browser verification (Playwright, Chromium):

- Viewports: 1440×900, 834×1112, 390×844, 320×720; plus 1440×900 with reduced motion.
- No `pageerror` on any run.
- Console: two expected `401` responses from `/api/auth/me` when unauthenticated, and one Motion development warning under reduced motion (“You have Reduced Motion enabled…”). No other errors.
- Login navigation and in-page anchor both verified.
- DOM measurements recorded for card bounds, gap, opacity, computed matrices and document width (see sections 4 and 8).

## 12. Build and lint

- TypeScript: clean (`tsc --noEmit`).
- ESLint: clean for the repository.
- Vite build: success in ~100 ms after transform; output sizes above.
- Only warning: chunks larger than 500 kB. Not introduced by the landing page logic, but the landing route is in that bundle.

## 13. Screenshots and evidence

Stored in `.agents/tasks/landing-evidence/`:

| File | View |
| --- | --- |
| `desktop-hero.png` | Desktop hero at scroll 0 |
| `desktop-showcase.png` | Desktop composition settled at scroll 800 |
| `desktop-full.png` | Full desktop page |
| `tablet-showcase.png` | Tablet composition at scroll 900 |
| `mobile-hero.png` | Mobile hero |
| `mobile-showcase.png` | Mobile showcase at scroll 700 |
| `mobile-full.png` | Full mobile page |
| `reduced-hero.png` | Desktop reduced-motion, static composition |
| `desktop-reduced-motion.png` | Earlier reduced-motion capture |

The implementing model cannot consume image input, so these files are evidence for human review, not a substitute for it. Visual judgments in this report are limited to measured DOM geometry, computed transforms, opacity, overflow and console output. No claim is made about perceived polish, color harmony or typographic balance in the screenshots.

## 14. Files changed

Modified:

- `apps/client/src/pages/LandingPage.tsx` — full landing rewrite.
- `apps/client/src/App.test.tsx` — new landing expectations.
- `apps/client/src/setupTests.ts` — IntersectionObserver polyfill.
- `apps/client/package.json` — `lenis` dependency.
- `package-lock.json` — lockfile update.

Added:

- `apps/client/src/components/landing/DualDashboardShowcase.tsx`
- `apps/client/src/components/landing/DashboardPreviews.tsx`
- `apps/client/src/components/layout/SmoothScroll.tsx`
- `apps/client/src/hooks/useMediaQuery.ts`
- `apps/client/src/pages/LandingPage.test.tsx`
- `.agents/tasks/landing-evidence/` (screenshots)
- `.agents/tasks/landing-page-dual-dashboard-report.md` (this report)

Nothing was committed, pushed, reset or cleaned. Existing working-tree changes were preserved.

## 15. Limitations and risks

- **No semantic visual review.** The screenshots exist, but the implementing model cannot view images. A human should check spacing, card readability at 60°, and mobile rhythm against the captures.
- **Chromium only.** Firefox and Safari were not exercised. 3D transforms, `overflow-x-clip`, Lenis wheel behaviour and reduced-motion fallbacks can differ there.
- **Preview data is illustrative.** Names, readings and counts are hardcoded and labeled as examples; they are not derived from the database.
- **10px chart labels.** The reused `ValueBars` component renders its axis labels at 10px. This is inherited from the real chart implementation, not introduced here, but it is small for a marketing surface and should be reviewed if the component is meant to be read closely.
- **Bundle size.** The landing route shares a 540 kB entry chunk; Vite's chunk warning remains. Code-splitting the authenticated app is the sensible follow-up, out of scope here.
- **Lenis scope.** Smoothing is intentionally limited to the landing page and is destroyed on unmount. Any future global scroll work must not mount a second instance.
- **Anchor offset.** Lenis `anchors: true` plus `scroll-mt-6` lands the showcase 24px below the viewport top; if the fixed header changes height, that offset must be revisited.
- **Reduced-motion warning.** Motion logs a development-only console warning when reduced motion is active. It is noisy but harmless.
