import AdminClient from '../../../../../client/AdminClient.js';
import { redirectIfForbidden } from '../../../../../utils/routing/redirects.js';

/**
 * Confirmation text shown before denying a user.
 *
 * @type {string}
 */
export const DENY_CONFIRM_MESSAGE = 'Deny this user? This is final and logs them out everywhere.';

const defaultConfirm = (message) => window.confirm(message);

/**
 * Controller for the Admin Users page: searches user accounts (optionally by approval status),
 * approves / denies them, and mints/sends recovery links for a specific one. Every method treats a
 * `403` `ApiError` the same way: redirect home, the same way `LoginController`/`HeaderController`
 * redirect — this is the fallback for the page being reached directly by hash despite the current
 * session not being an admin.
 */
export default class AdminUsersController {
  /**
   * Create an Admin Users controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {Function} options.setUsers - React state setter for the current search results.
   * @param {Function} options.setCurrentUserId - React state setter for the calling admin's own
   *   user id, as returned by the search.
   * @param {Function} options.setRowResults - React state setter for the per-user last-action
   *   result map (keyed by user id), holding either `{resetUrl}`, `{sent}`, or `{error}`.
   * @param {Function} options.setSearchError - React state setter for the search-time error
   *   message.
   * @param {typeof AdminClient} [options.client] - Admin HTTP client override, for testability.
   * @param {Function} [options.confirm] - Confirmation dialog override (receives the message and
   *   returns a boolean), for testability; defaults to `window.confirm`.
   */
  constructor({
    setUsers, setCurrentUserId, setRowResults, setSearchError,
    client = AdminClient, confirm = defaultConfirm,
  }) {
    this.setUsers = setUsers;
    this.setCurrentUserId = setCurrentUserId;
    this.setRowResults = setRowResults;
    this.setSearchError = setSearchError;
    this.client = client;
    this.confirm = confirm;
  }

  /**
   * Search user accounts and store the results (and the caller's own user id), or the search
   * error on failure.
   *
   * @param {string} q - Search term matched against `username`/`email`.
   * @param {('pending'|'approved'|'denied')} [status] - Approval status filter; `undefined` for
   *   every status.
   * @returns {Promise<void>} Resolves once the search finishes.
   */
  async handleSearch(q, status) {
    this.setSearchError(null);

    try {
      const { users, currentUserId } = await this.client.searchUsers(q, status);
      this.setUsers(users);
      this.setCurrentUserId(currentUserId);
    } catch (error) {
      this.#handleTopLevelError(error);
    }
  }

  /**
   * Approve a pending user and replace their row with the returned account; on failure, show the
   * error in that row and leave it unchanged.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async handleApprove(userId) {
    try {
      const { user } = await this.client.approveUser(userId);
      this.#replaceUser(user);
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  /**
   * Ask for confirmation, then deny a user and replace their row with the returned account; on
   * failure, show the error in that row and leave it unchanged. Cancelling sends nothing.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes (or immediately when cancelled).
   */
  async handleDeny(userId) {
    if (!this.confirm(DENY_CONFIRM_MESSAGE)) {
      return;
    }

    try {
      const { user } = await this.client.denyUser(userId);
      this.#replaceUser(user);
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  /**
   * Mint a fresh recovery link for a user and store it against that user's row.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async handleGenerateLink(userId) {
    try {
      const { resetUrl } = await this.client.generateRecoveryLink(userId);
      this.#setRowResult(userId, { resetUrl });
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  /**
   * Force-send a recovery email to a user and store the outcome against that user's row.
   *
   * @param {number} userId - The target user's numeric id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async handleSendEmail(userId) {
    try {
      const { sent } = await this.client.sendRecoveryEmail(userId);
      this.#setRowResult(userId, { sent });
    } catch (error) {
      this.#handleRowError(userId, error);
    }
  }

  #replaceUser(user) {
    this.setUsers((current) => current.map((u) => (u.id === user.id ? user : u)));
    this.setRowResults((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });
  }

  #setRowResult(userId, result) {
    this.setRowResults((current) => ({ ...current, [userId]: result }));
  }

  #handleTopLevelError(error) {
    if (redirectIfForbidden(error)) {
      return;
    }

    this.setSearchError(error.message);
  }

  #handleRowError(userId, error) {
    if (redirectIfForbidden(error)) {
      return;
    }

    this.#setRowResult(userId, { error: error.message });
  }
}
