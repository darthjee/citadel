import FormFieldsHelper from '../../forms/helpers/FormFieldsHelper.jsx';

const FIELDS_BY_MODE = new Map([
  ['password', [
    ['username', 'text', 'Username'],
    ['password', 'password', 'Password'],
  ]],
  ['register', [
    ['username', 'text', 'Username'],
    ['email', 'email', 'Email'],
    ['password', 'password', 'Password'],
    ['passwordConfirmation', 'password', 'Confirm password'],
  ]],
  ['recover', [
    ['email', 'email', 'Email'],
  ]],
  ['resetPassword', [
    ['password', 'password', 'New password'],
    ['passwordConfirmation', 'password', 'Confirm new password'],
  ]],
  ['device', [
    ['username', 'text', 'Username'],
  ]],
]);

const MODE_TABS = [
  ['password', 'Password'],
  ['register', 'Register'],
  ['recover', 'Recover'],
  ['device', 'Authorize with logged device'],
];

const SUBMIT_LABELS = new Map([
  ['password', 'Log in'],
  ['register', 'Register'],
  ['recover', 'Send reset link'],
  ['resetPassword', 'Set new password'],
  ['device', 'Send request'],
]);

/** Terminal device-panel copy, keyed by the `device:*` result-panel value. */
const DEVICE_PANEL_MESSAGES = new Map([
  ['device:denied', 'The request was denied on the other device.'],
  ['device:expired', 'The request expired before it was approved.'],
  ['device:logged', 'This login was already completed on another device.'],
  ['device:notFound', 'That request could not be found.'],
]);


/**
 * Render an Authorize-with-logged-device panel: the `device:waiting` variant shows a spinner
 * and a live `mm:ss` countdown to `state.deviceExpiresAt` with no retry control; every
 * terminal variant (`denied` / `expired` / `logged` / `notFound`) shows its copy plus a
 * retry that routes through `onSelectMode('device')` back to the empty username form.
 *
 * @param {string} panel - The `device:*` result-panel value.
 * @param {{deviceExpiresAt: (string|null), now: (number|undefined)}} state - Modal state.
 * @param {{onSelectMode: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered device panel.
 */
function renderDevicePanel(panel, state, handlers) {
  if (panel === 'device:waiting') {
    return (
      <div>
        <div className="spinner-border" role="status" />
        <p>Waiting for another device to approve…</p>
        <p className="font-monospace">{formatCountdown(state)}</p>
      </div>
    );
  }

  return (
    <div>
      <p>{DEVICE_PANEL_MESSAGES.get(panel)}</p>
      <button
        type="button"
        className="btn btn-link p-0"
        onClick={() => handlers.onSelectMode('device')}
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Render the post-submission result panel for the Recover / Set-new-password / device modes.
 *
 * @param {string} panel - Which panel to render (`'recover'`, `'resetPassword'`, or a
 *   `'device:*'` value).
 * @param {object} state - Modal state, read by the device waiting-panel countdown.
 * @param {{onSelectMode: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered result panel.
 */
function renderResultPanel(panel, state, handlers) {
  if (panel.startsWith('device:')) {
    return renderDevicePanel(panel, state, handlers);
  }

  if (panel === 'resetPassword') {
    return (
      <div>
        <p>Your password has been updated.</p>
        <button
          type="button"
          className="btn btn-link p-0"
          onClick={() => handlers.onSelectMode('password')}
        >
          Back to log in
        </button>
      </div>
    );
  }

  return <p>If that email matches an account, a reset link is on its way.</p>;
}

/**
 * Format the time left until `state.deviceExpiresAt` as `mm:ss`, clamped at `00:00`, using
 * `state.now` when provided (else the current time) as the reference point.
 *
 * @param {{deviceExpiresAt: (string|null), now: (number|undefined)}} state - Modal state.
 * @returns {string} The remaining time as `mm:ss`.
 */
function formatCountdown(state) {
  const expiry = Date.parse(state.deviceExpiresAt);
  const now = state.now ?? Date.now();
  const remainingMs = Number.isFinite(expiry) ? Math.max(expiry - now, 0) : 0;
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

/**
 * Render the mode selector (Password / Register / Recover / Authorize with logged device),
 * marking the active mode.
 *
 * @param {{mode: string}} state - Modal state.
 * @param {{onSelectMode: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered mode selector.
 */
function renderModeSelector(state, handlers) {
  return (
    <div className="btn-group mb-3" role="group">
      {MODE_TABS.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          className={`btn btn-outline-primary${state.mode === mode ? ' active' : ''}`}
          onClick={() => handlers.onSelectMode(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Render the active mode's sub-form: its submit-time error, its fields, and its submit
 * button.
 *
 * @param {object} state - Modal state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered sub-form.
 */
function renderForm(state, handlers) {
  const mode = FIELDS_BY_MODE.has(state.mode) ? state.mode : 'password';
  const onChangeByField = new Map([
    ['username', handlers.onUsernameChange],
    ['email', handlers.onEmailChange],
    ['password', handlers.onPasswordChange],
    ['passwordConfirmation', handlers.onPasswordConfirmationChange],
  ]);

  return (
    <form onSubmit={handlers.onSubmit} noValidate>
      {FormFieldsHelper.renderSubmitError(state)}
      {FIELDS_BY_MODE.get(mode).map(([name, type, label]) => FormFieldsHelper.renderField(
        name, type, label, state, onChangeByField.get(name), 'login-modal-',
      ))}
      <button type="submit" className="btn btn-primary">{SUBMIT_LABELS.get(mode)}</button>
    </form>
  );
}

/**
 * Rendering helper for the login modal's body: the Password / Register / Recover / Authorize-
 * with-logged-device mode selector and the active mode's sub-form, or — when `state.resultPanel`
 * is set — the neutral Recover panel, the Set-new-password success panel, or a device panel
 * (waiting countdown / denied / expired / logged / not-found) in place of the selector + form.
 * Kept separate from {@link LoginModalHelper} (the `Modal` shell) so its plain markup stays
 * unit-testable without a DOM. Follows the object-module convention: a plain exported object
 * whose public methods are the only entry points, with private render pieces kept as
 * module-level functions.
 */
const LoginModalFormsHelper = {
  /**
   * Render either the result panel (when `state.resultPanel` is set) or the mode selector plus
   * the active mode's sub-form.
   *
   * @param {{mode: string, username: string, email: string, password: string,
   *   passwordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   resultPanel: (string|null), deviceExpiresAt: (string|null), now: (number|undefined)}}
   *   state - Modal state.
   * @param {{onSelectMode: Function, onSubmit: Function, onUsernameChange: Function,
   *   onEmailChange: Function, onPasswordChange: Function,
   *   onPasswordConfirmationChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered modal body.
   */
  render(state, handlers) {
    if (state.resultPanel) {
      return (
        <div>
          {renderResultPanel(state.resultPanel, state, handlers)}
        </div>
      );
    }

    return (
      <div>
        {renderModeSelector(state, handlers)}
        {renderForm(state, handlers)}
      </div>
    );
  },
};

export default LoginModalFormsHelper;
