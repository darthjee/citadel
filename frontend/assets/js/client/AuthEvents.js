const AUTH_CHANGED_EVENT = 'auth:changed';

/**
 * Shared `window`-event bus for auth-state changes. Wraps a single `CustomEvent` type so any
 * component — the header or otherwise, present or future — can react to a login/logout
 * transition independently, with zero coupling to whichever component/controller triggered it.
 * A plain object module, matching {@link module:client/ApiClient}'s style.
 */
const AuthEvents = {
  /**
   * Announce an auth-state change to every current subscriber.
   *
   * @param {boolean} loggedIn - Whether a session is now active.
   * @param {boolean} [isAdmin] - Whether the current session belongs to an admin user.
   * @param {boolean} [pending] - Whether the stored session belongs to a user still awaiting
   *   admin approval (always paired with `loggedIn: false`).
   * @returns {void} Nothing.
   */
  emit(loggedIn, isAdmin = false, pending = false) {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, {
      detail: { loggedIn, isAdmin, pending },
    }));
  },

  /**
   * Subscribe to auth-state changes.
   *
   * @param {Function} handler - Called with the `CustomEvent` whose `detail` carries the new
   *   auth state (`loggedIn`, `isAdmin`, `pending`).
   * @returns {void} Nothing.
   */
  subscribe(handler) {
    window.addEventListener(AUTH_CHANGED_EVENT, handler);
  },

  /**
   * Unsubscribe from auth-state changes.
   *
   * @param {Function} handler - The handler previously passed to {@link AuthEvents.subscribe}.
   * @returns {void} Nothing.
   */
  unsubscribe(handler) {
    window.removeEventListener(AUTH_CHANGED_EVENT, handler);
  },
};

export default AuthEvents;
