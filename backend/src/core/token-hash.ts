import { createHash } from 'node:crypto';

/**
 * Computes the SHA-256 hex digest of `token`. This is the single source of truth for token
 * hashing across the backend — every module that persists a hash of a bearer/poll/reset token
 * (`TokenService`, `PasswordResetService`, `AuthorizationRequestService`) delegates here instead
 * of reimplementing the hash independently.
 * @param {string} token - The raw token to hash.
 * @returns {string} The SHA-256 hex digest of `token`.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
