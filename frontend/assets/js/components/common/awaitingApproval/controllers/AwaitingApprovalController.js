import AccountsClient from '../../../../client/AccountsClient.js';
import AuthStatus from '../../../../client/AuthStatus.js';

/** Shown when the status re-check itself fails (network error, server error, ...). */
export const CHECK_FAILED_MESSAGE = 'Could not check your account status, please try again.';

/**
 * Controller for the Awaiting-approval view: re-checks the pending account's status on demand
 * (the view's Check again button and window focus — never on a timer) and logs out through the
 * header's existing logout handler.
 */
export default class AwaitingApprovalController {
  /**
   * Create an awaiting-approval controller.
   *
   * @param {Function} setError - React state setter for the shown error message.
   * @param {Function} onLogout - The header's logout handler (ends the session, emits logged
   *   out and redirects home).
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setError, onLogout, client = AccountsClient) {
    this.setError = setError;
    this.onLogout = onLogout;
    this.client = client;
  }

  /**
   * Re-check the account status through {@link AuthStatus.refresh}, which announces the new
   * state on the auth bus (an approved user leaves the view). Clears any previous error first,
   * and shows {@link CHECK_FAILED_MESSAGE} when the check fails.
   *
   * @returns {Promise<void>} Resolves once the check (or its failure) is handled.
   */
  async checkAgain() {
    this.setError(null);

    try {
      await AuthStatus.refresh(this.client);
    } catch {
      this.setError(CHECK_FAILED_MESSAGE);
    }
  }

  /**
   * Log out through the header's existing logout handler.
   *
   * @param {Event} event - The click event, forwarded to the header's handler.
   * @returns {Promise<void>} Resolves once logout handling finishes.
   */
  logout(event) {
    return this.onLogout(event);
  }
}
