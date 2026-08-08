import ApiClient from './ApiClient.js';
import AuthSession from './AuthSession.js';
import pickDefined from './pickDefined.js';

/**
 * HTTP client for auth-related requests (registration, login, refresh, logout). Every method
 * that receives a fresh refresh token persists it via {@link AuthSession} before resolving,
 * and `logout` clears it regardless of whether the request itself succeeds — the client-side
 * session should still end.
 */
const AccountsClient = {
  /**
   * Register a new account.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Registration form fields.
   * @returns {Promise<{user: object, refreshToken: string}>} The created account and its
   *   refresh token.
   */
  async register({
    username, email, password, passwordConfirmation,
  }) {
    const result = await ApiClient.postJson('/auth/register.json', {
      username,
      email,
      password,
      password_confirmation: passwordConfirmation,
    });

    AuthSession.set(result.refreshToken);

    return result;
  },

  /**
   * Log in with a username and password.
   *
   * @param {{username: string, password: string}} credentials - Login credentials.
   * @returns {Promise<{user: object, refreshToken: string}>} The logged-in user and its
   *   refresh token.
   */
  async login({ username, password }) {
    const result = await ApiClient.postJson('/auth/login.json', { username, password });

    AuthSession.set(result.refreshToken);

    return result;
  },

  /**
   * Rotate a refresh token for a fresh access token.
   *
   * @param {string} refreshToken - The current refresh token.
   * @returns {Promise<{user: object, refreshToken: string}>} The user and the renewed
   *   refresh token.
   */
  async refresh(refreshToken) {
    const result = await ApiClient.postJson('/auth/refresh.json', { refreshToken });

    AuthSession.set(result.refreshToken);

    return result;
  },

  /**
   * Log out, invalidating the given refresh token server-side. The stored refresh token is
   * cleared even when the request fails, so the client-side session always ends.
   *
   * @param {string} refreshToken - The refresh token to invalidate.
   * @returns {Promise<void>} Resolves once logout handling finishes.
   */
  async logout(refreshToken) {
    try {
      await ApiClient.deleteJson('/auth/logoff.json', { refreshToken });
    } finally {
      AuthSession.clear();
    }
  },

  /**
   * Check whether a refresh token is still active, without consuming or rotating it. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.refresh}, this does not touch
   * `AuthSession` itself — a `false` result means clearing a now-known-stale token, not setting
   * a new one, which is the caller's responsibility.
   *
   * @param {string} refreshToken - The refresh token to check.
   * @returns {Promise<{loggedIn: boolean, isAdmin: boolean}>} Whether the token is still active,
   *   and whether that session belongs to an admin user (always `false` when `loggedIn` is
   *   `false`).
   */
  async status(refreshToken) {
    return ApiClient.postJson('/auth/status.json', { refreshToken });
  },

  /**
   * Request a password recovery email. Unlike {@link AccountsClient.login}/
   * {@link AccountsClient.register}, this never touches `AuthSession` — this flow never issues
   * a refresh token.
   *
   * @param {string} email - The account email to send a recovery link to.
   * @returns {Promise<{sent: boolean}>} Always resolves; the backend never reveals whether the
   *   email matched an account.
   */
  async recover(email) {
    return ApiClient.postJson('/auth/recover.json', { email });
  },

  /**
   * Complete a password recovery flow using the token from the recovery link. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.register}, this never touches
   * `AuthSession` — this flow never issues a refresh token.
   *
   * @param {{token: string, password: string, passwordConfirmation: string}} fields - The
   *   recovery token and new password fields.
   * @returns {Promise<{reset: boolean}>} Resolves on a successful reset; rejects with an
   *   `ApiError` on any rejection reason (unknown, used, or expired token).
   */
  async resetPassword({ token, password, passwordConfirmation }) {
    return ApiClient.postJson('/auth/reset-password.json', {
      token,
      password,
      password_confirmation: passwordConfirmation,
    });
  },

  /**
   * Open an authorization request so an already-logged-in device can approve this login.
   * Unlike {@link AccountsClient.login}/{@link AccountsClient.register}, this never touches
   * `AuthSession` — this flow never issues a refresh token. The response shape is identical
   * for an unknown username (enumeration-safety).
   *
   * @param {string} username - The username attempting to log in.
   * @returns {Promise<{uuid: string, pollToken: string, expiresAt: string}>} The request
   *   identifier, the token used to poll it, and its ISO-8601 expiry timestamp.
   */
  async createAuthorizationRequest(username) {
    return ApiClient.postJson('/auth/authorization-requests.json', { username });
  },

  /**
   * Poll an authorization request for its current status. When the status is `approved` the
   * response also carries `user` and `refreshToken`; the token is persisted via
   * {@link AuthSession} before resolving, so the modal's success path is identical to
   * {@link AccountsClient.login}. Every other status (`open`, `denied`, `expired`, `logged`)
   * resolves untouched. An unknown `uuid` or wrong `pollToken` surfaces as an `ApiError` with
   * `.status === 404` thrown from {@link ApiClient}; it is not caught here.
   *
   * @param {string} uuid - The authorization request identifier.
   * @param {string} pollToken - The token returned by
   *   {@link AccountsClient.createAuthorizationRequest}.
   * @returns {Promise<{status: string, user?: object, refreshToken?: string}>} The current
   *   status, plus credentials on the winning `approved` poll.
   */
  async pollAuthorizationRequest(uuid, pollToken) {
    const result = await ApiClient.postJson(
      `/auth/authorization-requests/${uuid}/poll.json`,
      { pollToken },
    );

    if (result.status === 'approved') {
      AuthSession.set(result.refreshToken);
    }

    return result;
  },

  /**
   * List the caller's own open authorization requests, for the approving device to review.
   * Unlike {@link AccountsClient.login}/{@link AccountsClient.register}, this never touches
   * `AuthSession` — this flow never issues a refresh token.
   *
   * @returns {Promise<{requests: Array<{uuid: string, requestIp: string,
   *   requestUserAgent: string, createdAt: string, expiresAt: string}>}>} The caller's open
   *   authorization requests.
   */
  async listAuthorizationRequests() {
    return ApiClient.postJson('/auth/authorization-requests/mine.json', {});
  },

  /**
   * Approve an authorization request as the account owner, confirming with the account
   * password. Unlike {@link AccountsClient.login}/{@link AccountsClient.register}, this never
   * touches `AuthSession` — this flow never issues a refresh token. A `400` (wrong password,
   * wrong owner, wrong status, or expired — the backend collapses all of these into one message)
   * surfaces as a thrown `ApiError`; it is not caught here.
   *
   * @param {string} uuid - The authorization request identifier.
   * @param {string} password - The account owner's password, confirming the approval.
   * @returns {Promise<{authorized: boolean}>} Resolves once the request is authorized.
   */
  async authorizeAuthorizationRequest(uuid, password) {
    return ApiClient.postJson(
      `/auth/authorization-requests/${uuid}/authorize.json`,
      { password },
    );
  },

  /**
   * Deny an authorization request as the account owner. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.register}, this never touches
   * `AuthSession` — this flow never issues a refresh token. Same `400`-as-thrown-`ApiError`
   * behavior as {@link AccountsClient.authorizeAuthorizationRequest}, it is not caught here.
   *
   * @param {string} uuid - The authorization request identifier.
   * @returns {Promise<{denied: boolean}>} Resolves once the request is denied.
   */
  async denyAuthorizationRequest(uuid) {
    return ApiClient.postJson(`/auth/authorization-requests/${uuid}/deny.json`, {});
  },

  /**
   * Update the caller's own account, confirming with the current password. Unlike
   * {@link AccountsClient.login}/{@link AccountsClient.register}, this never touches
   * `AuthSession` — no token refresh or re-login is triggered on success. `username`, `email`,
   * and `newPassword` are only included in the request body when defined, so callers may update
   * any subset of them; a `newPasswordConfirmation` field is never sent — that check is
   * client-side only.
   *
   * @param {{currentPassword: string, username?: string, email?: string,
   *   newPassword?: string}} fields - The current password (always required) plus any fields
   *   to update.
   * @returns {Promise<{username: string, email: string}>} The account's updated username and
   *   email.
   */
  async updateAccount({
    currentPassword, username, email, newPassword,
  }) {
    return ApiClient.patchJson('/auth/account.json', {
      currentPassword,
      ...pickDefined({ username, email, newPassword }),
    });
  },
};

export default AccountsClient;
