import AdminClient from '../../../../../client/AdminClient.js';
import { redirectIfForbidden } from '../../../../../utils/routing/redirects.js';

/**
 * Controller for the Admin Users page: searches user accounts, and mints/sends recovery links
 * for a specific one. Every method treats a `403` `ApiError` the same way: redirect home, the
 * same way `LoginController`/`HeaderController` redirect — this is the fallback for the page
 * being reached directly by hash despite the current session not being an admin.
 */
export default class AdminUsersController {
  /**
   * Create an Admin Users controller.
   *
   * @param {Function} setUsers - React state setter for the current search results.
   * @param {Function} setRowResults - React state setter for the per-user last-action result map
   *   (keyed by user id), holding either `{resetUrl}`, `{sent}`, or `{error}`.
   * @param {Function} setSearchError - React state setter for the search-time error message.
   * @param {typeof AdminClient} [client] - Admin HTTP client override, for testability.
   */
  constructor(setUsers, setRowResults, setSearchError, client = AdminClient) {
    this.setUsers = setUsers;
    this.setRowResults = setRowResults;
    this.setSearchError = setSearchError;
    this.client = client;
  }

  /**
   * Search user accounts and store the results, or the search error on failure.
   *
   * @param {string} q - Search term matched against `username`/`email`.
   * @returns {Promise<void>} Resolves once the search finishes.
   */
  async handleSearch(q) {
    this.setSearchError(null);

    try {
      const { users } = await this.client.searchUsers(q);
      this.setUsers(users);
    } catch (error) {
      this.#handleTopLevelError(error);
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
