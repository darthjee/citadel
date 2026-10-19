import AccountsClient from './AccountsClient.js';
import AuthSession from './AuthSession.js';
import AuthEvents from './AuthEvents.js';

/**
 * Single place that confirms the stored session against `POST /auth/status.json` and announces
 * the result on the shared {@link AuthEvents} bus. Reused by every status re-check (the header's
 * mount-time check, and the re-checks after login and register). A plain object module, matching
 * {@link module:client/AuthEvents}'s style.
 */
const AuthStatus = {
  /**
   * Re-check the stored session and emit the resulting auth state.
   *
   * - No stored refresh token: emits logged-out, without any request.
   * - `loggedIn: true`: keeps the token and emits logged-in with the admin flag.
   * - `status: 'pending'`: keeps the token (the user is awaiting admin approval) and emits
   *   logged-out with `pending: true`.
   * - Anything else: clears the now-stale token and emits logged-out.
   *
   * Request errors are not caught; the caller decides how to handle them.
   *
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   * @returns {Promise<void>} Resolves once the status has been emitted.
   */
  async refresh(client = AccountsClient) {
    const token = AuthSession.get();

    if (!token) {
      AuthEvents.emit(false, false, false);
      return;
    }

    const { loggedIn, isAdmin, status } = await client.status(token);

    if (loggedIn) {
      AuthEvents.emit(true, Boolean(isAdmin), false);
      return;
    }

    if (status === 'pending') {
      AuthEvents.emit(false, false, true);
      return;
    }

    AuthSession.clear();
    AuthEvents.emit(false, false, false);
  },
};

export default AuthStatus;
