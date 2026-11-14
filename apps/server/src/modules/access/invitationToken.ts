import { createHash, randomBytes } from 'node:crypto';

/**
 * Invitation tokens are 256 bits of CSPRNG entropy, URL-safe. Only the
 * SHA-256 hash is persisted; the plaintext exists solely in the HTTP response
 * to the inviting doctor (and is never logged).
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
