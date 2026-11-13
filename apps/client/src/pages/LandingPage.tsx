import { Link, useNavigate } from 'react-router-dom';
import { ValueBars } from '../components/charts/ValueBars.js';
import { Button } from '../components/ui/Button.js';
import { BrandMark, PlusIcon } from '../components/ui/icons.js';

/**
 * Static preview of the app's own cards, rendered with the same classes as
 * the real ones. Plausible, internally consistent demo data:
 * - Today's rhythm: three readings (98, 122, 131 → average 117.0, lowest 98,
 *   highest 131) and one empty slot to show the add affordance.
 * - Month to date: 24 readings over 13 days, lowest 111, highest 125, mean
 *   over all readings 117.7; the bars are the per-day averages.
 */
const PREVIEW_SLOTS = [
  { short: 'Morning', full: 'Morning (fasting)', value: 98 },
  { short: 'Breakfast', full: 'After breakfast', value: 122 },
  { short: 'Lunch', full: 'After lunch', value: 131 },
  { short: 'Dinner', full: 'After dinner', value: null },
];

const MONTH_AVERAGE_POINTS = [
  { label: '1', value: 114 },
  { label: '2', value: 118 },
  { label: '3', value: 111 },
  { label: '4', value: 123 },
  { label: '5', value: 116 },
  { label: '6', value: 125 },
  { label: '7', value: 117 },
  { label: '8', value: 119 },
  { label: '9', value: 113 },
  { label: '10', value: 122 },
  { label: '11', value: 116 },
  { label: '12', value: 121 },
  { label: '13', value: 115 },
];

const FEATURES = [
  {
    label: 'Daily rhythm',
    line: 'Morning fasting to after dinner, every reading in its place',
  },
  {
    label: 'Readable history',
    line: 'Grouped by date, filter down to any single day',
  },
  {
    label: 'Honest reports',
    line: 'Daily, month-to-date and previous-month views from your own readings',
  },
];

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
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl sm:leading-[1.1]">
              Track your glucose, four readings a day
            </h1>
            <p className="mt-4 max-w-md text-lg leading-7 text-ink-soft">
              A calm, personal log for your daily readings, your history and your month at a glance
            </p>
            <div className="mt-7 flex items-center gap-4">
              <Button onClick={() => navigate('/register')} className="min-h-12 px-6 text-base">
                Create account
              </Button>
              <Link
                to="/login"
                className="flex min-h-12 items-center text-sm font-medium text-olive underline-offset-2 hover:text-olive-dark hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_48px_-24px_rgb(52_63_43/0.25)] sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Today's readings</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {PREVIEW_SLOTS.map((slot) =>
                slot.value !== null ? (
                  <div key={slot.short} className="rounded-xl bg-sage/40 p-3">
                    <span className="block text-xs font-medium text-ink-soft">{slot.short}</span>
                    <span className="mt-1 block text-xl font-semibold tabular-nums text-ink">
                      {slot.value}
                      <span className="ml-1 text-xs font-normal text-ink-soft">mg/dL</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-soft">{slot.full}</span>
                  </div>
                ) : (
                  <div
                    key={slot.short}
                    className="rounded-xl border border-dashed border-line bg-cream/60 p-3"
                  >
                    <span className="block text-xs font-medium text-ink-soft">{slot.short}</span>
                    <span className="mt-2 flex items-center gap-1 text-sm font-medium text-olive">
                      <PlusIcon className="size-3.5" />
                      Add
                    </span>
                  </div>
                ),
              )}
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm text-ink-soft">
                <span className="whitespace-nowrap">
                  Today's average{' '}
                  <strong className="font-semibold tabular-nums text-ink">117.0 mg/dL</strong>
                </span>{' '}
                <span className="whitespace-nowrap">
                  · lowest <strong className="font-semibold tabular-nums text-ink">98</strong>
                </span>{' '}
                <span className="whitespace-nowrap">
                  · highest <strong className="font-semibold tabular-nums text-ink">131</strong>
                </span>
              </p>
            </div>

            <div className="mt-5 border-t border-line pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-ink">Month to date</h2>
                <span className="text-xs text-ink-soft">1–13 November 2026</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                    24
                  </dd>
                  <dt className="mt-0.5 text-xs font-medium text-ink-soft">Readings</dt>
                </div>
                <div>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                    117.7<span className="ml-1 text-sm font-normal text-ink-soft">mg/dL</span>
                  </dd>
                  <dt className="mt-0.5 text-xs font-medium text-ink-soft">Average</dt>
                </div>
                <div>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                    111<span className="ml-1 text-sm font-normal text-ink-soft">mg/dL</span>
                  </dd>
                  <dt className="mt-0.5 text-xs font-medium text-ink-soft">Lowest</dt>
                </div>
                <div>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                    125<span className="ml-1 text-sm font-normal text-ink-soft">mg/dL</span>
                  </dd>
                  <dt className="mt-0.5 text-xs font-medium text-ink-soft">Highest</dt>
                </div>
              </dl>
              <p className="mt-5 text-xs font-medium text-ink-soft">
                Daily averages (mg/dL) — only days with readings
              </p>
              <div className="mt-2">
                <ValueBars
                  points={MONTH_AVERAGE_POINTS}
                  average={117.7}
                  title="Average glucose per day, month to date"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-8 border-t border-line pt-6 sm:grid-cols-3 sm:gap-10">
          {FEATURES.map((feature) => (
            <div key={feature.label}>
              <h3 className="text-sm font-semibold text-ink">{feature.label}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">{feature.line}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 text-sm text-ink-soft sm:px-6">
          A personal log — not a medical device
        </div>
      </footer>
    </div>
  );
}
