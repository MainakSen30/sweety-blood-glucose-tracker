import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPatients } from '../services/doctorApi.js';
import type { DoctorPatientLink } from '../services/doctorApi.js';
import { Button, LoadingState } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { ArrowRightIcon } from '../components/ui/icons.js';
import { formatDoctorDate } from '../lib/doctor.js';
import { StatusPill } from '../components/doctor/DoctorUi.js';

/**
 * Assigned-patient directory. The backend returns every actively assigned
 * patient and supports neither search nor pagination, so filtering happens
 * client-side over that already-authorized list.
 */
export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<DoctorPatientLink[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await listPatients();
        if (cancelled) return;
        setPatients(next);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const needle = query.trim().toLowerCase();
  const visiblePatients = [...(patients ?? [])]
    .filter(
      (link) =>
        !needle ||
        link.patient.name.toLowerCase().includes(needle) ||
        link.patient.email.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.patient.name.localeCompare(b.patient.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Patients</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Only patients with an active, patient-accepted assignment appear here.
          </p>
        </div>
        <Link
          to="/doctor/invitations"
          className="inline-flex min-h-9 items-center rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors duration-150 hover:border-olive/40 hover:bg-sage/40"
        >
          Invitations
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-sm">
            <Field label="Search patients" hint="Filter by name or email in your assigned list.">
              {(fieldProps) => (
                <Input
                  fieldProps={fieldProps}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name or email"
                  autoComplete="off"
                />
              )}
            </Field>
          </div>
          {patients !== null ? (
            <p aria-live="polite" className="text-xs tabular-nums text-ink-soft">
              {visiblePatients.length} of {patients.length} patients
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-soft">We couldn't load your patients.</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setReloadNonce((nonce) => nonce + 1)}
            >
              Try again
            </Button>
          </div>
        ) : patients === null ? (
          <LoadingState label="Loading patients" className="py-16" />
        ) : patients.length === 0 ? (
          <div className="py-10">
            <p className="text-sm font-medium text-ink">No patients assigned yet</p>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              Invite a patient, then share the invitation token with them. Their readings appear
              here after they accept.
            </p>
            <Link
              to="/doctor/invitations"
              className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-olive-dark px-3 text-xs font-medium text-cream transition-colors duration-150 hover:bg-olive"
            >
              Go to invitations
            </Link>
          </div>
        ) : visiblePatients.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-ink-soft">No patients match “{query.trim()}”.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-5 hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] gap-4 border-b border-line pb-2 text-xs font-medium text-ink-soft sm:grid">
              <span>Patient</span>
              <span>Access</span>
              <span className="w-5" />
            </div>
            <ul aria-label="Assigned patients" className="divide-y divide-line">
              {visiblePatients.map((link) => (
                <li key={link.assignmentId}>
                  <Link
                    to={`/doctor/patients/${link.patient.id}`}
                    className="grid gap-2 py-3.5 transition-colors duration-150 hover:bg-sage/20 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-1"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {link.patient.name}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">
                        {link.patient.email}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusPill tone="active">Active</StatusPill>
                      <span className="truncate text-xs text-ink-soft">
                        {link.acceptedAt
                          ? `since ${formatDoctorDate(link.acceptedAt)}`
                          : 'consent accepted'}
                      </span>
                    </span>
                    <ArrowRightIcon className="hidden size-4 text-ink-soft sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
