import type { ReactNode } from 'react';
import { INVITATION_TONE_CLASSES, type InvitationTone } from '../../lib/doctor.js';

/** Shared, small doctor-panel components. Not a generic component system. */

export function StatusPill({ tone, children }: { tone: InvitationTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${INVITATION_TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function ReadonlyPill() {
  return (
    <span className="inline-flex rounded-md border border-line bg-beige/60 px-2 py-1 text-xs font-medium text-ink-soft">
      Read-only
    </span>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    </div>
  );
}
