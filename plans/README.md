# Animation plans

Plans produced by the improve-animations advisor. Executors need zero context: each
plan is self-contained and stamped with the commit it was written against.

| # | Title | Severity | Status |
|---|---|---|---|
| 001 | Landing page entrance: staggered fade-and-rise on every load | LOW | TODO |

## Execution order

1. `001-landing-entrance.md` — no dependencies, no other plans yet.

## Notes

- 001 overrides the landing's original "no motion-on-load" design decision at the
  product owner's explicit request (see plan Problem section).
- Plans target the commit stamped in each file; `reconcile` refreshes file:line
  references after unrelated changes land.
