import AccountsClient from '../../../../client/AccountsClient.js';
import AuthSession from '../../../../client/AuthSession.js';
import AuthEvents from '../../../../client/AuthEvents.js';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';
import { redirectHome } from '../../../../utils/routing/redirects.js';

/**
 * Controller for the Header's logout action and mount-time auth-status confirmation. Logout ends
 * the session via {@link AccountsClient.logout} and redirects home regardless of whether the
 * request succeeded — `AccountsClient.logout` already clears `AuthSession` unconditionally.
 */
export default class HeaderController {
  /**
   * Create a header controller.
   *
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(client = AccountsClient) {
    this.client = client;
  }

  /**
   * Log out the current session and redirect home. Always redirects and emits the new
   * `false` auth state, even when the logout request itself fails, since `AccountsClient.logout`
   * already clears `AuthSession` client-side unconditionally.
   *
   * @returns {Promise<void>} Resolves once logout handling finishes.
   */
  async handleLogout() {
    try {
      await this.client.logout(AuthSession.get());
    } catch {
      // Ignored: the client-side session is already cleared by AccountsClient.logout,
      // regardless of whether the network request itself succeeded.
    } finally {
      AuthEvents.emit(false, false);
      redirectHome();
    }
  }

  /**
   * Open the login modal in the given mode via the shared {@link LoginModalEvents} bus. A pure
   * client-side state transition — issues no API call of its own.
   *
   * @param {string} mode - Which mode to open the modal in (`'password'` or `'register'`).
   * @returns {void} Nothing.
   */
  openLoginModal(mode) {
    LoginModalEvents.open(mode);
  }

  /**
   * Confirm the current auth state against the backend and announce it via {@link AuthEvents}.
   * Skips the network call entirely when there is no stored refresh token — a missing token is
   * unambiguously "logged out". When the backend reports the stored token is no longer active,
   * the stale token is cleared from `AuthSession` before emitting, so `ApiClient`'s 401-retry
   * logic does not keep attempting to refresh with a token already known to be dead.
   *
   * @returns {Promise<void>} Resolves once the status check finishes.
   */
  async checkStatus() {
    const token = AuthSession.get();

    if (!token) {
      AuthEvents.emit(false, false);
      return;
    }

    const { loggedIn, isAdmin } = await this.client.status(token);

    if (!loggedIn) {
      AuthSession.clear();
    }

    AuthEvents.emit(loggedIn, isAdmin);
  }
}
