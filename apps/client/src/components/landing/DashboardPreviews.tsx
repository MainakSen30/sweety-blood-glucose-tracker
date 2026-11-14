import type { ReactNode } from 'react';
import { ValueBars } from '../charts/ValueBars.js';
import { ReadonlyPill } from '../doctor/DoctorUi.js';
import { ArrowRightIcon, BrandMark, MailIcon, UsersIcon } from '../ui/icons.js';

/**
 * Lightweight static previews of the two implemented dashboards. They reuse
 * the real surfaces, chart component and type scale, but never fetch data or
 * mount the authenticated pages. The demo data is illustrative only and lives
 * here, away from the application database.
 */

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

const TODAY_SLOTS = [
  { short: 'Morning', full: 'Morning (fasting)', value: 98 },
  { short: 'Breakfast', full: 'After breakfast', value: 122 },
  { short: 'Lunch', full: 'After lunch', value: 131 },
  { short: 'Dinner', full: 'After dinner', value: null },
];

const ASSIGNED_PATIENTS = [
  { name: 'Maya Reyes', detail: 'consent since 2 Nov' },
  { name: 'Daniel Okoye', detail: 'consent since 4 Nov' },
];

function PreviewWindow({
  audience,
  meta,
  children,
}: {
  audience: string;
  meta: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_32px_64px_-36px_rgb(52_63_43/0.4)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark className="size-5 shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-olive-dark">Sweety</span>
          <span className="truncate text-xs text-ink-soft">· {audience}</span>
        </div>
        {meta}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function PatientPreview() {
  return (
    <PreviewWindow
      audience="Patient"
      meta={<span className="shrink-0 text-[11px] text-ink-soft">Saturday 14 November</span>}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold tracking-tight text-ink">Good morning, Maya</h3>
        <span className="text-[11px] text-ink-soft">Today</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TODAY_SLOTS.map((slot) =>
          slot.value !== null ? (
            <div key={slot.short} className="rounded-lg bg-sage/40 p-2.5">
              <span className="block text-[11px] font-medium text-ink-soft">{slot.short}</span>
              <span className="mt-0.5 block text-lg font-semibold tabular-nums text-ink">
                {slot.value}
                <span className="ml-1 text-[11px] font-normal text-ink-soft">mg/dL</span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-ink-soft">
                {slot.full}
              </span>
            </div>
          ) : (
            <div
              key={slot.short}
              className="rounded-lg border border-dashed border-line bg-cream/60 p-2.5"
            >
              <span className="block text-[11px] font-medium text-ink-soft">{slot.short}</span>
              <span className="mt-2 block text-xs font-medium text-olive">Add reading</span>
            </div>
          ),
        )}
      </div>

      <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-soft">
        Today's average <strong className="font-semibold tabular-nums text-ink">117.0 mg/dL</strong>
        {' · '}lowest <strong className="font-semibold tabular-nums text-ink">98</strong>
        {' · '}highest <strong className="font-semibold tabular-nums text-ink">131</strong>
      </p>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">Month to date</h4>
        <span className="text-[11px] text-ink-soft">1–13 November</span>
      </div>

      <dl className="mt-2 grid grid-cols-4 gap-2">
        {[
          { label: 'Readings', value: '24' },
          { label: 'Average', value: '117.7' },
          { label: 'Lowest', value: '111' },
          { label: 'Highest', value: '125' },
        ].map((stat) => (
          <div key={stat.label}>
            <dd className="text-base font-semibold tabular-nums tracking-tight text-ink">
              {stat.value}
            </dd>
            <dt className="mt-0.5 text-[11px] font-medium text-ink-soft">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[11px] font-medium text-ink-soft">Daily averages (mg/dL)</p>
      <div className="mt-1">
        <ValueBars
          points={MONTH_AVERAGE_POINTS}
          average={117.7}
          title="Illustrative average glucose per day, month to date"
        />
      </div>
    </PreviewWindow>
  );
}

function CompactStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="mt-1 block text-xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </span>
    </div>
  );
}

export function DoctorPreview() {
  return (
    <PreviewWindow audience="Doctor console" meta={<ReadonlyPill />}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold tracking-tight text-ink">Dashboard</h3>
        <span className="text-[11px] text-ink-soft">Accepted patients only</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <CompactStat
          icon={<UsersIcon className="size-3" />}
          label="Assigned patients"
          value="6"
        />
        <CompactStat
          icon={<MailIcon className="size-3" />}
          label="Pending invitations"
          value="2"
        />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">Recently assigned</h4>
        <span className="text-[11px] text-ink-soft">View all</span>
      </div>

      <ul className="mt-1 divide-y divide-line">
        {ASSIGNED_PATIENTS.map((patient) => (
          <li key={patient.name} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-ink">{patient.name}</span>
              <span className="block truncate text-[11px] text-ink-soft">{patient.detail}</span>
            </span>
            <ArrowRightIcon className="size-3.5 shrink-0 text-ink-soft" />
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-ink">Maya Reyes</h4>
          <span className="text-[11px] text-ink-soft">Month to date</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-soft">
          <strong className="font-semibold tabular-nums text-ink">117.7 mg/dL</strong> average · 24
          readings
        </p>
        <div className="mt-2">
          <ValueBars
            points={MONTH_AVERAGE_POINTS}
            average={117.7}
            title="Illustrative patient average glucose, month to date"
          />
        </div>
      </div>
    </PreviewWindow>
  );
}
