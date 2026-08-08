import AccountsClient from '../../../../client/AccountsClient.js';
import AuthEvents from '../../../../client/AuthEvents.js';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';
import AuthorizationRequestPoller from '../../../../utils/polling/AuthorizationRequestPoller.js';
import { validateRegistration, validateResetPassword } from '../../../../utils/validation/formValidators.js';
import { redirectHome } from '../../../../utils/routing/redirects.js';

/** Every field any mode can hold; switching modes resets to exactly this. */
const INITIAL_FIELDS = {
  username: '', email: '', password: '', passwordConfirmation: '',
};

/** The modes the modal can be in. */
const MODES = {
  password: 'password',
  register: 'register',
  recover: 'recover',
  resetPassword: 'resetPassword',
  device: 'device',
};

/** Maps an {@link AuthorizationRequestPoller} rejection status to its result-panel value. */
const DEVICE_REJECTION_PANELS = new Map([
  ['denied', 'device:denied'],
  ['expired', 'device:expired'],
  ['logged', 'device:logged'],
  ['notFound', 'device:notFound'],
]);

/**
 * Controller for the login modal: owns mode state and per-mode submission. Password mode
 * authenticates via {@link AccountsClient.login}; Register mode validates with
 * {@link validateRegistration}'s rules then calls {@link AccountsClient.register} — both converge
 * on the shared success handler that closes the modal and redirects home. Recover mode calls
 * {@link AccountsClient.recover} and always shows the neutral "check your email" panel;
 * Set-new-password mode validates with {@link validateResetPassword}'s rules then calls
 * {@link AccountsClient.resetPassword} and shows a success panel — neither closes the modal,
 * emits auth state, nor redirects. Authorize-with-logged-device mode opens a request via
 * {@link AccountsClient.createAuthorizationRequest} and polls it with an
 * {@link AuthorizationRequestPoller}: approval reuses the success handler, every other outcome
 * shows its own panel.
 */
export default class LoginModalController {
  /**
   * Create a login-modal controller.
   *
   * @param {Function} setMode - React state setter for the active mode.
   * @param {Function} setFields - React state setter for the form field values.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setResultPanel - React state setter for the shown result panel
   *   (`'recover'`, `'resetPassword'`, `'device:*'`, or `null`).
   * @param {Function} setDeviceExpiresAt - React state setter for the current authorization
   *   request's ISO-8601 expiry, or `null` when not in device mode.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(
    setMode, setFields, setFieldErrors, setSubmitError, setResultPanel, setDeviceExpiresAt,
    client = AccountsClient,
  ) {
    this.setMode = setMode;
    this.setFields = setFields;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setResultPanel = setResultPanel;
    this.setDeviceExpiresAt = setDeviceExpiresAt;
    this.client = client;
    this.poller = null;
  }

  /**
   * Switch the modal between modes, tearing down any running authorization-request poller,
   * resetting every form field, clearing all errors, and dropping any shown result panel — no
   * field values carry over between modes.
   *
   * @param {string} mode - The mode to switch to (`'password'`, `'register'`, `'recover'`,
   *   `'resetPassword'`, or `'device'`).
   * @returns {void} Nothing.
   */
  switchMode(mode) {
    this.stopPoller();
    this.setDeviceExpiresAt(null);
    this.setMode(mode);
    this.setFields({ ...INITIAL_FIELDS });
    this.setFieldErrors({});
    this.setSubmitError(null);
    this.setResultPanel(null);
  }

  /**
   * Stop and drop the active authorization-request poller, if any. Null-safe and idempotent —
   * safe to call when no poll is in progress.
   *
   * @returns {void} Nothing.
   */
  stopPoller() {
    this.poller?.stop();
    this.poller = null;
  }

  /**
   * Submit the modal form for the active mode.
   *
   * @param {string} mode - The active mode (`'password'`, `'register'`, `'recover'`,
   *   `'resetPassword'`, or `'device'`).
   * @param {object} fields - Current form field values.
   * @param {string} resetToken - The recovery token, used only by Set-new-password mode.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  handleSubmit(mode, fields, resetToken) {
    const handlers = new Map([
      [MODES.register, () => this.#submitRegister(fields)],
      [MODES.recover, () => this.#submitRecover(fields)],
      [MODES.resetPassword, () => this.#submitResetPassword(fields, resetToken)],
      [MODES.device, () => this.#submitDevice(fields)],
    ]);

    return (handlers.get(mode) ?? (() => this.#submitPassword(fields)))();
  }

  /**
   * Password-mode submit: authenticate against the backend, converging on the shared success
   * handler, or set a submit-error message on failure — same shape as today's `LoginController`.
   *
   * @param {{username: string, password: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitPassword(fields) {
    this.setSubmitError(null);

    try {
      this.#handleSuccess(await this.client.login(fields));
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Register-mode submit: run the shared registration validation and skip the API call when it
   * fails; on a clean form, register (which also logs in) and converge on the shared success
   * handler, or set a submit-error message on failure — same shape as today's
   * `RegisterController`.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitRegister(fields) {
    const errors = validateRegistration(fields);

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);

    try {
      this.#handleSuccess(await this.client.register(fields));
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Recover-mode submit: request a password recovery email, then always show the neutral
   * "check your email" panel from a `finally` block so a rejected request looks identical to a
   * successful one — the enumeration-safety contract, mirroring the old
   * `RecoverController.handleSubmit`.
   *
   * @param {{email: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitRecover(fields) {
    this.setSubmitError(null);

    try {
      await this.client.recover(fields.email);
    } finally {
      this.setResultPanel('recover');
    }
  }

  /**
   * Set-new-password-mode submit: run the shared reset-password validation and skip the API
   * call when it fails; on a clean form, submit the token and new password, then show the
   * success panel — never closes the modal, emits auth state, nor redirects. Sets a
   * submit-error message on failure.
   *
   * @param {{password: string, passwordConfirmation: string}} fields - Current form field
   *   values.
   * @param {string} token - The recovery token carried in from the recovery link.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitResetPassword(fields, token) {
    const errors = validateResetPassword(fields);

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);

    try {
      await this.client.resetPassword({ token, ...fields });
      this.setResultPanel('resetPassword');
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Authorize-with-logged-device submit: open an authorization request for the typed username,
   * then show the waiting panel and start polling. On approval the poller calls the shared
   * success handler; any other terminal status routes through {@link #handleDeviceRejection}. A
   * failed request keeps the user on the form with a submit-error message and starts no poller.
   *
   * @param {{username: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once the request is opened and polling has started.
   */
  async #submitDevice({ username }) {
    this.setSubmitError(null);

    let request;
    try {
      request = await this.client.createAuthorizationRequest(username);
    } catch (error) {
      this.setSubmitError(error.message);
      return;
    }

    const { uuid, pollToken, expiresAt } = request;

    this.setDeviceExpiresAt(expiresAt);
    this.setResultPanel('device:waiting');

    this.poller = new AuthorizationRequestPoller({
      uuid, pollToken, expiresAt, client: this.client,
      onApproved: (result) => this.#handleSuccess(result),
      onRejected: (status) => this.#handleDeviceRejection(status),
    });
    this.poller.start();
  }

  /**
   * Handle a terminal, non-approved authorization-request outcome: show the panel matching the
   * status (`denied` / `expired` / `logged` / `notFound`) and tear the poller down.
   *
   * @param {string} status - The poller's rejection status.
   * @returns {void} Nothing.
   */
  #handleDeviceRejection(status) {
    this.setResultPanel(DEVICE_REJECTION_PANELS.get(status));
    this.stopPoller();
  }

  /**
   * Shared success path for Password / Register / approved-device flows: the refresh token is
   * already persisted by the `AccountsClient` call, so announce the new logged-in auth state,
   * close the modal, and redirect home.
   *
   * @param {{user: {isAdmin: boolean}}} result - The successful login/register/approval
   *   response.
   * @returns {void} Nothing.
   */
  #handleSuccess(result) {
    AuthEvents.emit(true, result.user.isAdmin);
    LoginModalEvents.close();
    redirectHome();
  }
}
