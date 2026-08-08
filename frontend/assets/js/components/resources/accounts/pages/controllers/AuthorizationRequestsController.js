import AccountsClient from '../../../../../client/AccountsClient.js';

/**
 * Controller for the "My account → Authorizations" page: lists the caller's own open
 * authorization requests and lets them approve or deny each one. Every method that reaches
 * {@link AccountsClient} treats a falsy (`undefined`) result the same way: return immediately,
 * without touching any state — {@link module:client/ApiClient} already opened the login modal
 * itself on a session-expired `401`, so there is nothing left for this page to do.
 */
export default class AuthorizationRequestsController {
  /**
   * Create an Authorization Requests controller.
   *
   * @param {Function} setRequests - React state setter for the current list of open
   *   authorization requests.
   * @param {Function} setLoadError - React state setter for the list-load error message.
   * @param {Function} setRowState - React state setter for the per-request row UI state, a
   *   `Map` keyed by request uuid whose values hold `{open, password, error}`.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setRequests, setLoadError, setRowState, client = AccountsClient) {
    this.setRequests = setRequests;
    this.setLoadError = setLoadError;
    this.setRowState = setRowState;
    this.client = client;
  }

  /**
   * Load the caller's own open authorization requests, or store the load error on failure.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load() {
    try {
      const result = await this.client.listAuthorizationRequests();

      if (!result) {
        return;
      }

      this.setRequests(result.requests);
      this.setLoadError(null);
    } catch (error) {
      this.setLoadError(error.message);
    }
  }

  /**
   * Approve an authorization request as the account owner, confirming with the account
   * password. On success, the list is reloaded so the now-authorized request drops off it.
   *
   * @param {string} uuid - The authorization request identifier.
   * @param {string} password - The account owner's password, confirming the approval.
   * @returns {Promise<void>} Resolves once the approval (and, on success, the reload) finishes.
   */
  async authorize(uuid, password) {
    return this.#performRowAction(
      uuid,
      () => this.client.authorizeAuthorizationRequest(uuid, password),
    );
  }

  /**
   * Deny an authorization request as the account owner. On success, the list is reloaded so the
   * now-denied request drops off it.
   *
   * @param {string} uuid - The authorization request identifier.
   * @returns {Promise<void>} Resolves once the denial (and, on success, the reload) finishes.
   */
  async deny(uuid) {
    return this.#performRowAction(uuid, () => this.client.denyAuthorizationRequest(uuid));
  }

  /**
   * Shared guard-and-set-row-error logic for {@link AuthorizationRequestsController#authorize}/
   * {@link AuthorizationRequestsController#deny}: run the given API call, guard its
   * session-expired `undefined` result, clear the row's error and reload the list on success,
   * or store the thrown `ApiError`'s message against the row on failure.
   *
   * @param {string} uuid - The authorization request identifier, used to key the row state.
   * @param {Function} apiCall - Zero-argument function performing the row's API call.
   * @returns {Promise<void>} Resolves once the action (and, on success, the reload) finishes.
   */
  async #performRowAction(uuid, apiCall) {
    try {
      const result = await apiCall();

      if (!result) {
        return;
      }

      this.patchRow(uuid, { error: null });
      await this.load();
    } catch (error) {
      this.patchRow(uuid, { error: error.message });
    }
  }

  /**
   * Merge a patch into a single request row's UI state, preserving its other fields (e.g.
   * `open`/`password`). The row-state updater always returns a new `Map`, never mutating the
   * current one, so React sees a new reference and re-renders.
   *
   * @param {string} uuid - The authorization request identifier, used to key the row state.
   * @param {object} patch - The fields to merge into that row's state.
   * @returns {void} Nothing.
   */
  patchRow(uuid, patch) {
    this.setRowState((current) => new Map(current).set(uuid, { ...current.get(uuid), ...patch }));
  }
}
