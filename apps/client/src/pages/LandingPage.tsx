import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { DualDashboardShowcase } from '../components/landing/DualDashboardShowcase.js';
import { SmoothScroll } from '../components/layout/SmoothScroll.js';
import {
  ArrowRightIcon,
  BrandMark,
  PersonIcon,
  StethoscopeIcon,
} from '../components/ui/icons.js';

const PATIENT_STEPS = [
  {
    title: 'Log each part of the day',
    line: 'Morning fasting, after breakfast, after lunch and after dinner. One reading per slot.',
  },
  {
    title: 'Read the history by date',
    line: 'Every entry grouped by day, with a filter down to a single date.',
  },
  {
    title: 'See the month, not just today',
    line: 'Daily, month-to-date and previous-month reports, calculated from your own readings.',
  },
  {
    title: 'Decide who sees it',
    line: "Accept a doctor's invitation, or revoke access from your care team at any time.",
  },
];

const DOCTOR_STEPS = [
  {
    title: 'Invite a registered patient',
    line: 'Create a one-time token and share it out of band. It expires after seven days.',
  },
  {
    title: 'Track consent, not guesses',
    line: 'Accepted invitations become your assigned patients. Revoked access disappears.',
  },
  {
    title: 'Read the record',
    line: 'Filter reading history by date and open daily, month-to-date or previous-month reports.',
  },
  {
    title: 'Generate reports in the background',
    line: 'Queue a report and follow its status without blocking the page.',
  },
];

const PLATFORM_FEATURES = [
  {
    title: 'Patient-granted access',
    line: 'A doctor sees readings only after the patient accepts an invitation, and only while it stays active.',
  },
  {
    title: 'Two separate accounts',
    line: 'Patients and doctors get different navigation, permissions and views of the same record.',
  },
  {
    title: 'Reports from real readings',
    line: 'Daily, month-to-date and previous-month summaries are calculated from recorded readings — never estimates.',
  },
  {
    title: 'Background generation',
    line: 'Report jobs run behind the page, so a long report never blocks the view.',
  },
  {
    title: 'Any screen',
    line: 'The patient app and doctor console are designed for phone, tablet and desktop.',
  },
];

const HOUSE_EASE = [0.23, 1, 0.32, 1] as const;

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const entrance = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col bg-cream">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2.5">
              <BrandMark className="size-7" />
              <span className="text-lg font-semibold tracking-tight text-olive-dark">Sweety</span>
            </Link>
            <div className="flex items-center gap-5">
              <Link
                to="/login"
                className="flex min-h-11 items-center text-sm font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="hidden min-h-9 items-center justify-center rounded-xl bg-olive-dark px-4 text-sm font-medium text-cream transition-colors duration-150 hover:bg-olive sm:inline-flex"
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <section
            aria-labelledby="hero-heading"
            className="mx-auto w-full max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20"
          >
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:items-end lg:gap-16">
              <motion.div
                initial={entrance.initial}
                animate={entrance.animate}
                transition={{ duration: 0.3, ease: HOUSE_EASE }}
              >
                <h1
                  id="hero-heading"
                  className="max-w-[18ch] text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.025em] text-ink sm:text-6xl lg:text-[4.25rem]"
                >
                  Better glucose tracking. Better connected care.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-7 text-ink-soft sm:text-xl sm:leading-8">
                  One platform for patients to understand their glucose patterns and doctors to
                  stay connected with the patients they care for.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    to="/register"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-olive-dark px-6 text-sm font-medium text-cream transition-colors duration-150 hover:bg-olive"
                  >
                    Get started
                  </Link>
                  <a
                    href="#experiences"
                    className="inline-flex min-h-12 items-center gap-1.5 text-sm font-medium text-olive underline-offset-2 hover:text-olive-dark hover:underline"
                  >
                    Explore Sweety
                    <ArrowRightIcon className="size-3.5" />
                  </a>
                </div>
                <p className="mt-6 text-sm text-ink-soft">
                  Patient app and doctor console, connected by patient consent.
                </p>
              </motion.div>

              <motion.dl
                initial={entrance.initial}
                animate={entrance.animate}
                transition={{ duration: 0.3, ease: HOUSE_EASE, delay: reduceMotion ? 0 : 0.07 }}
                className="hidden border-l border-line pl-6 lg:block"
              >
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-ink">
                    <PersonIcon className="size-4 text-olive" />
                    Patients
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-ink-soft">
                    Four readings a day, from morning fasting to after dinner.
                  </dd>
                </div>
                <div className="mt-5 border-t border-line pt-5">
                  <dt className="flex items-center gap-2 text-sm font-medium text-ink">
                    <StethoscopeIcon className="size-4 text-olive" />
                    Doctors
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-ink-soft">
                    Read-only access to the patients who accept an invitation.
                  </dd>
                </div>
                <div className="mt-5 border-t border-line pt-5">
                  <dt className="text-sm font-medium text-ink">Consent</dt>
                  <dd className="mt-1 text-sm leading-6 text-ink-soft">
                    Access starts with the patient and can be revoked at any time.
                  </dd>
                </div>
              </motion.dl>
            </div>
          </section>

          <DualDashboardShowcase />

          <RoleSection
            id="patients"
            role="For patients"
            icon={<PersonIcon className="size-4" />}
            title="Four readings a day, kept in one place"
            copy="Record the day in four moments, then see today, the month and the pattern without a spreadsheet."
            steps={PATIENT_STEPS}
            cta="Create a patient account"
          />

          <RoleSection
            id="doctors"
            role="For doctors"
            icon={<StethoscopeIcon className="size-4" />}
            title="The patients who invited you, read-only"
            copy="See the patient directory, open a consented record, and read the same daily and monthly reports the patient sees."
            steps={DOCTOR_STEPS}
            cta="Create a doctor account"
            note="Doctors cannot edit readings, prescribe, or change a patient's record."
          />

          <section
            aria-labelledby="platform-heading"
            className="border-t border-line bg-surface"
          >
            <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
                <div>
                  <p className="text-sm font-medium text-olive">Platform</p>
                  <h2
                    id="platform-heading"
                    className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
                  >
                    Consent is the connection
                  </h2>
                  <p className="mt-3 max-w-md text-base leading-7 text-ink-soft">
                    The patient record is the source of truth. Everything around it is built to keep
                    access deliberate.
                  </p>
                </div>

                <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {PLATFORM_FEATURES.map((feature) => (
                    <div key={feature.title}>
                      <dt className="text-sm font-semibold text-ink">{feature.title}</dt>
                      <dd className="mt-1 text-sm leading-6 text-ink-soft">{feature.line}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          <section aria-labelledby="cta-heading" className="border-t border-line">
            <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
              <div className="rounded-3xl bg-olive-dark px-6 py-10 sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
                <div className="max-w-xl">
                  <h2
                    id="cta-heading"
                    className="text-3xl font-semibold tracking-tight text-cream sm:text-4xl"
                  >
                    Start with your next reading
                  </h2>
                  <p className="mt-3 text-base leading-7 text-sage">
                    Create an account to log readings and share them with your care team — or sign
                    in to the console you already use.
                  </p>
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 lg:mt-0 lg:shrink-0">
                  <Link
                    to="/register"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cream px-6 text-sm font-medium text-olive-dark transition-colors duration-150 hover:bg-surface"
                  >
                    Get started
                  </Link>
                  <Link
                    to="/login"
                    className="flex min-h-12 items-center text-sm font-medium text-sage underline-offset-2 hover:text-cream hover:underline"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2.5">
              <BrandMark className="size-5" />
              <span className="font-medium text-olive-dark">Sweety</span>
            </div>
            <p>A personal log — not a medical device</p>
            <div className="flex gap-5">
              <Link
                to="/login"
                className="transition-colors duration-150 hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="transition-colors duration-150 hover:text-ink"
              >
                Get started
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </SmoothScroll>
  );
}

function RoleSection({
  id,
  role,
  icon,
  title,
  copy,
  steps,
  cta,
  note,
}: {
  id: string;
  role: string;
  icon: ReactNode;
  title: string;
  copy: string;
  steps: Array<{ title: string; line: string }>;
  cta: string;
  note?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-olive">
              {icon}
              {role}
            </p>
            <h2
              id={`${id}-heading`}
              className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
            >
              {title}
            </h2>
            <p className="mt-3 max-w-md text-base leading-7 text-ink-soft">{copy}</p>
            <Link
              to="/register"
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-olive underline-offset-2 hover:text-olive-dark hover:underline"
            >
              {cta}
              <ArrowRightIcon className="size-3.5" />
            </Link>
            {note ? <p className="mt-4 text-sm text-ink-soft">{note}</p> : null}
          </div>

          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step.title} className="bg-surface p-5 sm:p-6">
                <span className="text-[11px] font-medium tabular-nums text-ink-soft">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{step.line}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
