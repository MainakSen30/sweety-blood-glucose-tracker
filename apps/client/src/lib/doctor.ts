import type { DoctorInvitation } from '../services/doctorApi.js';

export function formatDoctorDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export type InvitationTone = 'pending' | 'active' | 'expired' | 'closed';

export function invitationTone(invitation: DoctorInvitation): InvitationTone {
  if (invitation.expired || invitation.status === 'expired') return 'expired';
  if (invitation.status === 'active') return 'active';
  if (invitation.status === 'pending') return 'pending';
  return 'closed';
}

export function invitationLabel(invitation: DoctorInvitation): string {
  if (invitation.expired) return 'Expired';
  if (invitation.status === 'active') return 'Accepted';
  if (invitation.status === 'rejected') return 'Declined';
  return invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1);
}

export const INVITATION_TONE_CLASSES: Record<InvitationTone, string> = {
  pending: 'bg-sage/60 text-olive-dark',
  active: 'bg-olive-dark text-cream',
  expired: 'bg-beige text-ink-soft',
  closed: 'bg-terracotta/15 text-terracotta-ink',
};
