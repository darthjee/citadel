/**
 * Injection token for the Core-owned session-lookup port. `JwtGuard` depends
 * on it; the Auth module provides the implementation (`SessionService`), so
 * `core/` never imports `auth/`.
 */
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');

/**
 * The user owning an active session, as read from the database. `JwtGuard`
 * builds `request.user` from it instead of trusting the token's claims.
 */
export interface SessionUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

/**
 * Port resolving an access token's `sid` claim to the user owning that
 * session, when the session is still active (not revoked, not expired).
 */
export interface SessionLookup {
  /**
   * Finds the user owning the active session identified by `sid`.
   * @param {string} sid - The session UUID carried by the access token.
   * @returns {Promise<SessionUser | null>} The session's user, or `null` when
   *   no active session matches.
   */
  findActiveSessionUser(sid: string): Promise<SessionUser | null>;
}
