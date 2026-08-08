import bcrypt from 'bcryptjs';

// A pre-computed bcrypt hash of a value nobody will ever submit, compared
// against when no user is found so lookups for unknown usernames take the
// same time as a wrong-password check (avoids trivial timing-based
// username enumeration) — ported from the old Authenticator.
export const DUMMY_DIGEST = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1eLXfPJvXQF4RUOgtnJhmiQq6Zsy';

/**
 * Compares `password` against `digest`, falling back to `DUMMY_DIGEST` when
 * `digest` is absent, so a lookup for a nonexistent row takes the same time
 * as a wrong-password check. Shared by `AuthService#validateCredentials` and
 * `AuthorizationRequestService#approverPasswordValid`.
 * @param {string} password - The plaintext password to verify.
 * @param {string} [digest] - The stored bcrypt digest to compare against, when the row was found.
 * @returns {Promise<boolean>} Whether `password` matches `digest` (or `DUMMY_DIGEST` when absent).
 */
export function compareOrDummy(password: string, digest?: string): Promise<boolean> {
  return bcrypt.compare(password, digest ?? DUMMY_DIGEST);
}
