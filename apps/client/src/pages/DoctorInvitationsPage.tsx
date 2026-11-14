import { useEffect, useState } from 'react';
import {
  invitePatient,
  listInvitations,
  type CreatedInvitation,
  type DoctorInvitation,
} from '../services/doctorApi.js';
import { ApiError } from '../services/http.js';
import { Button, LoadingState } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { StatusNote } from '../components/ui/StatusNote.js';
import { useStatusNote } from '../lib/useStatusNote.js';
import { formatDoctorDate, invitationLabel, invitationTone } from '../lib/doctor.js';
import { StatusPill } from '../components/doctor/DoctorUi.js';

type InvitationFilter = 'all' | 'pending' | 'accepted' | 'expired' | 'closed';

const FILTERS: Array<{ id: InvitationFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'expired', label: 'Expired' },
  { id: 'closed', label: 'Revoked or declined' },
];

function matchesFilter(invitation: DoctorInvitation, filter: InvitationFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return invitation.status === 'pending' && !invitation.expired;
  if (filter === 'accepted') return invitation.status === 'active';
  if (filter === 'expired') return invitation.expired || invitation.status === 'expired';
  return invitation.status === 'revoked' || invitation.status === 'rejected';
}

/**
 * Invitation history and creation. The raw token is displayed exactly once in
 * this component; it is never put in the URL, storage, or a log line.
 */
export default function DoctorInvitationsPage() {
  const [invitations, setInvitations] = useState<DoctorInvitation[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [filter, setFilter] = useState<InvitationFilter>('all');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [statusMessage, showMessage, clearMessage] = useStatusNote();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await listInvitations();
        if (cancelled) return;
        setInvitations(next);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setEmailError('');

    if (!email.trim()) {
      setEmailError('Enter the email address of a registered patient.');
      return;
    }

    setInviting(true);

    try {
      const invitation = await invitePatient(email.trim());
      setCreated(invitation);
      setEmail('');
      setReloadNonce((nonce) => nonce + 1);
      showMessage('Invitation created. Share the token with your patient.');
    } catch (err) {
      setEmailError(
        err instanceof ApiError ? err.message : 'Could not create the invitation. Try again.',
      );
    } finally {
      setInviting(false);
    }
  }

  const sorted = [...(invitations ?? [])].sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
  const visible = sorted.filter((invitation) => matchesFilter(invitation, filter));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Invitations</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Invite a registered patient. Access stays read-only and begins only after they accept.
        </p>
      </div>

      <StatusNote message={statusMessage} onDone={clearMessage} />

      <Card>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Invite a patient</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The patient must already have a Sweety account. Invitations expire after seven days.
        </p>
        <form onSubmit={(event) => void handleInvite(event)} className="mt-4 space-y-3">
          <Field label="Patient email" error={emailError}>
            {(fieldProps) => (
              <Input
                fieldProps={fieldProps}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="patient@example.com"
                autoComplete="off"
                className="max-w-md"
              />
            )}
          </Field>
          <Button type="submit" loading={inviting}>
            Create invitation
          </Button>
        </form>

        {created ? (
          <div className="mt-5 rounded-xl border border-olive/30 bg-sage/20 p-4">
            <p className="text-sm font-medium text-olive-dark">
              Invitation for {created.patient.name}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Share this token through a channel you trust. It is shown once and expires{' '}
              {formatDoctorDate(created.expiresAt)}.
            </p>
            <p className="mt-3 select-all break-all rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">
              {created.inviteToken}
            </p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCreated(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">History</h2>
          {invitations !== null ? (
            <p aria-live="polite" className="text-xs tabular-nums text-ink-soft">
              {visible.length} of {invitations.length} invitations
            </p>
          ) : null}
        </div>

        <div role="group" aria-label="Filter invitations" className="mt-3 flex flex-wrap gap-1">
          {FILTERS.map((option) => {
            const count = sorted.filter((invitation) =>
              matchesFilter(invitation, option.id),
            ).length;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors duration-150 ${
                  filter === option.id
                    ? 'bg-olive-dark text-cream'
                    : 'text-ink-soft hover:bg-sage/50 hover:text-ink'
                }`}
              >
                {option.label} <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-soft">We couldn't load your invitations.</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setReloadNonce((nonce) => nonce + 1)}
            >
              Try again
            </Button>
          </div>
        ) : invitations === null ? (
          <LoadingState label="Loading invitations" className="py-16" />
        ) : sorted.length === 0 ? (
          <p className="py-8 text-sm text-ink-soft">No invitations sent yet.</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-sm text-ink-soft">No invitations in this state.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {visible.map((invitation) => (
              <li
                key={invitation.assignmentId}
                className="flex flex-wrap items-start justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{invitation.patient.name}</p>
                  <p className="truncate text-xs text-ink-soft">{invitation.patient.email}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Sent {formatDoctorDate(invitation.invitedAt)} ·{' '}
                    {invitation.status === 'active' && invitation.acceptedAt
                      ? `accepted ${formatDoctorDate(invitation.acceptedAt)}`
                      : invitation.status === 'revoked' && invitation.revokedAt
                        ? `revoked ${formatDoctorDate(invitation.revokedAt)}`
                        : invitation.status === 'rejected' && invitation.rejectedAt
                          ? `declined ${formatDoctorDate(invitation.rejectedAt)}`
                          : `expires ${formatDoctorDate(invitation.expiresAt)}`}
                  </p>
                </div>
                <StatusPill tone={invitationTone(invitation)}>
                  {invitationLabel(invitation)}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
