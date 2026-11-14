import { useEffect, useState } from 'react';
import {
  acceptInvitation,
  getPatientAccess,
  rejectInvitation,
  revokeDoctor,
  type PatientAccessOverview,
} from '../services/accessApi.js';
import { ApiError } from '../services/http.js';
import { Button, LoadingState } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { StatusNote } from '../components/ui/StatusNote.js';
import { useStatusNote } from '../lib/useStatusNote.js';

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/**
 * Patient consent centre: active doctors can be revoked, pending invitations
 * can be accepted with the token the doctor received, or rejected outright.
 */
export default function CareTeamPage() {
  const [overview, setOverview] = useState<PatientAccessOverview | null>(null);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [token, setToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [statusMessage, showMessage, clearMessage] = useStatusNote();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await getPatientAccess();
        if (cancelled) return;
        setOverview(next);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const refresh = () => setReloadNonce((nonce) => nonce + 1);

  async function handleAccept(event: React.FormEvent) {
    event.preventDefault();
    setTokenError('');

    if (!token.trim()) {
      setTokenError('Paste the invitation token your doctor shared with you.');
      return;
    }

    setBusy('accept');

    try {
      await acceptInvitation(token.trim());
      setToken('');
      refresh();
      showMessage('Doctor access granted.');
    } catch (err) {
      setTokenError(
        err instanceof ApiError ? err.message : 'Could not accept this invitation. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(assignmentId: string) {
    setBusy(assignmentId);

    try {
      await rejectInvitation(assignmentId);
      refresh();
      showMessage('Invitation rejected.');
    } catch {
      showMessage('Could not reject this invitation.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(assignmentId: string) {
    setBusy(assignmentId);

    try {
      await revokeDoctor(assignmentId);
      refresh();
      showMessage('Doctor access revoked.');
    } catch {
      showMessage('Could not revoke access.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Care team</h1>
        <p className="mt-1 text-sm text-ink-soft">
          You decide which doctors can see your readings and reports. Access is read-only and can be
          revoked at any time.
        </p>
      </div>

      <StatusNote message={statusMessage} onDone={clearMessage} />

      <Card>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Add a doctor</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your doctor sends an invitation token out of band. Paste it here to grant read-only access
          until you revoke it.
        </p>
        <form onSubmit={(event) => void handleAccept(event)} className="mt-4 space-y-3">
          <Field label="Invitation token" error={tokenError}>
            {(fieldProps) => (
              <Input
                fieldProps={fieldProps}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste the token from your doctor"
                autoComplete="off"
              />
            )}
          </Field>
          <Button type="submit" loading={busy === 'accept'}>
            Accept invitation
          </Button>
        </form>
      </Card>

      {error ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-soft">We couldn't load your care team.</p>
          <div className="flex justify-center">
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          </div>
        </Card>
      ) : overview === null ? (
        <LoadingState label="Loading care team" className="py-16" />
      ) : (
        <>
          <Card>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Doctors with access</h2>
            {overview.doctors.length === 0 ? (
              <p className="py-6 text-sm text-ink-soft">
                No doctor has access right now. Accept an invitation above to add one.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {overview.doctors.map((link) => (
                  <li
                    key={link.assignmentId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{link.doctor.name}</p>
                      <p className="text-xs text-ink-soft">{link.doctor.email}</p>
                      {link.acceptedAt ? (
                        <p className="text-xs text-ink-soft">
                          Access since {formatTimestamp(link.acceptedAt)}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={busy === link.assignmentId}
                      onClick={() => void handleRevoke(link.assignmentId)}
                    >
                      Revoke access
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Pending invitations</h2>
            {overview.invitations.length === 0 ? (
              <p className="py-6 text-sm text-ink-soft">No invitations are waiting for you.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {overview.invitations.map((invitation) => (
                  <li
                    key={invitation.assignmentId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{invitation.doctor.name}</p>
                      <p className="text-xs text-ink-soft">{invitation.doctor.email}</p>
                      <p className="text-xs text-ink-soft">
                        Expires {formatTimestamp(invitation.expiresAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy === invitation.assignmentId}
                        onClick={() => void handleReject(invitation.assignmentId)}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
