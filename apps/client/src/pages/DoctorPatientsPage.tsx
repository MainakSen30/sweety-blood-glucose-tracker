import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  invitePatient,
  listInvitations,
  listPatients,
  type CreatedInvitation,
  type DoctorInvitation,
  type DoctorPatientLink,
} from '../services/doctorApi.js';
import { ApiError } from '../services/http.js';
import { Button, LoadingState } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { StatusNote } from '../components/ui/StatusNote.js';
import { useStatusNote } from '../lib/useStatusNote.js';
import { ArrowRightIcon } from '../components/ui/icons.js';

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function invitationState(invitation: DoctorInvitation): string {
  if (invitation.expired) return 'Expired';
  return invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1);
}

/**
 * Doctor home: patients who accepted an invitation, plus the invitation
 * history. The token is shown once here and must be delivered out of band —
 * this deployment has no email integration.
 */
export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<DoctorPatientLink[] | null>(null);
  const [invitations, setInvitations] = useState<DoctorInvitation[]>([]);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [statusMessage, showMessage, clearMessage] = useStatusNote();

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

  const refresh = () => setReloadNonce((nonce) => nonce + 1);

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
      refresh();
      showMessage('Invitation created. Share the token with your patient.');
    } catch (err) {
      setEmailError(
        err instanceof ApiError ? err.message : 'Could not create the invitation. Try again.',
      );
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Patients</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Read-only access appears here only after a patient accepts your invitation.
        </p>
      </div>

      <StatusNote message={statusMessage} onDone={clearMessage} />

      <Card>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Invite a patient</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The patient must have a Sweety account. Invitations expire after seven days.
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
              Share this token with your patient through a channel you trust. It is shown only once
              and expires {formatTimestamp(created.expiresAt)}.
            </p>
            <p className="mt-3 break-all rounded-lg bg-surface px-3 py-2 font-mono text-xs text-ink">
              {created.inviteToken}
            </p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCreated(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}
      </Card>

      {error ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-soft">We couldn't load your patients.</p>
          <div className="flex justify-center">
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          </div>
        </Card>
      ) : patients === null ? (
        <LoadingState label="Loading patients" className="py-16" />
      ) : (
        <>
          <Card>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Active patients</h2>
            {patients.length === 0 ? (
              <p className="py-6 text-sm text-ink-soft">
                No patient has accepted an invitation yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {patients.map((link) => (
                  <li key={link.assignmentId} className="py-3">
                    <Link
                      to={`/patients/${link.patient.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 transition-colors duration-150 hover:bg-sage/30"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{link.patient.name}</p>
                        <p className="text-xs text-ink-soft">{link.patient.email}</p>
                        {link.acceptedAt ? (
                          <p className="text-xs text-ink-soft">
                            Access since {formatTimestamp(link.acceptedAt)}
                          </p>
                        ) : null}
                      </div>
                      <ArrowRightIcon className="size-4 shrink-0 text-ink-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Invitations</h2>
            {invitations.length === 0 ? (
              <p className="py-6 text-sm text-ink-soft">No invitations sent yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.assignmentId}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{invitation.patient.name}</p>
                      <p className="text-xs text-ink-soft">{invitation.patient.email}</p>
                      <p className="text-xs text-ink-soft">
                        Sent {formatTimestamp(invitation.invitedAt)}
                      </p>
                    </div>
                    <span className="rounded-md bg-sage/50 px-2 py-1 text-xs font-medium text-olive-dark">
                      {invitationState(invitation)}
                    </span>
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
