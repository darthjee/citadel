/**
 * Computes the next attempt count and, when it trips the threshold, the lockout expiry for an
 * abuse-guard cool-off window — shared by `AccountEditAbuseGuardService` and
 * `AuthorizationRequestAbuseGuardService` so both apply the same "attempts + lockedUntil"
 * arithmetic instead of duplicating it.
 * @param {number} currentAttempts - The attempt count recorded before this attempt.
 * @param {number} maxAttempts - The attempt count (inclusive) at which the guard locks out.
 * @param {number} lockMs - How long, in milliseconds, the lockout lasts once tripped.
 * @returns {{ attempts: number; lockedUntil: Date | null }} The incremented attempt count, and the
 *   lockout expiry (or `null` when the threshold has not been reached yet).
 */
export function computeLockoutState(
  currentAttempts: number,
  maxAttempts: number,
  lockMs: number,
): { attempts: number; lockedUntil: Date | null } {
  const attempts = currentAttempts + 1;
  const lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + lockMs) : null;

  return { attempts, lockedUntil };
}
