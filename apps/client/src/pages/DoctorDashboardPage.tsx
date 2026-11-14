import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInvitations, listPatients } from '../services/doctorApi.js';
import type { DoctorInvitation, DoctorPatientLink } from '../services/doctorApi.js';
import { Button, LoadingState } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ArrowRightIcon } from '../components/ui/icons.js';
import { formatDoctorDate, invitationLabel, invitationTone } from '../lib/doctor.js';
import { StatCard, StatusPill } from '../components/doctor/DoctorUi.js';

/**
 * Doctor home. Counts and lists come from the assignment endpoints; the
 * backend exposes no reading-activity feed, so none is invented here.
 */
export default function DoctorDashboardPage() {
  const [patients, setPatients] = useState<DoctorPatientLink[] | null>(null);
  const [invitations, setInvitations] = useState<DoctorInvitation[]>([]);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [nextPatients, nextInvitations] = await Promise.all([
          listPatients(),
          listInvitations(),
        ]);
        if (cancelled) return;
        setPatients(nextPatients);
        setInvitations(nextInvitations);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const loading = patients === null && !error;
  const pending = invitations.filter(
    (invitation) => invitation.status === 'pending' && !invitation.expired,
  );
  const recentPatients = [...(patients ?? [])]
    .sort((a, b) => (b.acceptedAt ?? '').localeCompare(a.acceptedAt ?? ''))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Read-only overview of patients who accepted your invitation.
          </p>
        </div>
        <Link
          to="/doctor/invitations"
          className="inline-flex min-h-9 items-center rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors duration-150 hover:border-olive/40 hover:bg-sage/40"
        >
          Manage invitations
        </Link>
      </div>

      {error ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-soft">We couldn't load your dashboard.</p>
          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => setReloadNonce((nonce) => nonce + 1)}>
              Try again
            </Button>
          </div>
        </Card>
      ) : loading ? (
        <LoadingState label="Loading dashboard" className="py-20" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Assigned patients"
              value={patients?.length ?? 0}
              hint="Active, patient-accepted consent"
            />
            <StatCard
              label="Pending invitations"
              value={pending.length}
              hint="Waiting for the patient to accept"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-ink">Recently assigned</h2>
                <Link
                  to="/doctor/patients"
                  className="text-sm font-medium text-olive underline underline-offset-2 hover:text-olive-dark"
                >
                  View all
                </Link>
              </div>

              {recentPatients.length === 0 ? (
                <div className="py-8">
                  <p className="text-sm font-medium text-ink">No patients assigned yet</p>
                  <p className="mt-1 max-w-md text-sm text-ink-soft">
                    Access begins only after a patient accepts your invitation token.
                  </p>
                  <Link
                    to="/doctor/invitations"
                    className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-olive-dark px-3 text-xs font-medium text-cream transition-colors duration-150 hover:bg-olive"
                  >
                    Invite a patient
                  </Link>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {recentPatients.map((link) => (
                    <li key={link.assignmentId}>
                      <Link
                        to={`/doctor/patients/${link.patient.id}`}
                        className="flex items-center justify-between gap-3 py-3 transition-colors duration-150 hover:text-olive-dark"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {link.patient.name}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            {link.patient.email}
                            {link.acceptedAt
                              ? ` · consent since ${formatDoctorDate(link.acceptedAt)}`
                              : ''}
                          </span>
                        </span>
                        <ArrowRightIcon className="size-4 shrink-0 text-ink-soft" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Pending invitations</h2>
              {pending.length === 0 ? (
                <p className="py-6 text-sm text-ink-soft">
                  No invitation is waiting for a response.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {pending.slice(0, 5).map((invitation) => (
                    <li key={invitation.assignmentId} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {invitation.patient.name}
                          </p>
                          <p className="truncate text-xs text-ink-soft">
                            {invitation.patient.email}
                          </p>
                        </div>
                        <StatusPill tone={invitationTone(invitation)}>
                          {invitationLabel(invitation)}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        Expires {formatDoctorDate(invitation.expiresAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
