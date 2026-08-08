import Modal from 'react-bootstrap/cjs/Modal.js';
import LoginModalFormsHelper from './LoginModalFormsHelper.jsx';

const TITLES = new Map([
  ['password', 'Log in'],
  ['register', 'Create an account'],
  ['recover', 'Recover password'],
  ['resetPassword', 'Set a new password'],
  ['device', 'Authorize with logged device'],
]);

/**
 * Resolve the modal title for the active mode.
 *
 * @param {string} mode - The active mode (`'password'`, `'register'`, `'recover'`,
 *   `'resetPassword'`, or `'device'`).
 * @returns {string} The title text.
 */
function title(mode) {
  return TITLES.get(mode) ?? TITLES.get('password');
}

/**
 * Rendering helper for the login modal shell: a `react-bootstrap` `Modal` whose body is the
 * mode selector plus the active mode's sub-form (delegated to {@link LoginModalFormsHelper}).
 * Follows the object-module convention: a plain exported object whose public methods are
 * the only entry points, with private render pieces kept as module-level functions.
 */
const LoginModalHelper = {
  /**
   * Render the login modal. Renders nothing visible while `state.open` is false.
   *
   * @param {{open: boolean, mode: string, username: string, email: string, password: string,
   *   passwordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   resultPanel: (string|null)}} state - Modal state.
   * @param {{onClose: Function, onSelectMode: Function, onSubmit: Function,
   *   onUsernameChange: Function, onEmailChange: Function, onPasswordChange: Function,
   *   onPasswordConfirmationChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered modal.
   */
  render(state, handlers) {
    return (
      <Modal show={state.open} onHide={handlers.onClose}>
        <Modal.Header closeButton>
          <Modal.Title>{title(state.mode)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {LoginModalFormsHelper.render(state, handlers)}
        </Modal.Body>
      </Modal>
    );
  },
};

export default LoginModalHelper;
