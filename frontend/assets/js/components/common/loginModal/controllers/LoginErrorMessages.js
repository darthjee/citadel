/**
 * Message shown in the login modal when `login.json` answers `403 USER_DENIED` (correct password
 * on an account an administrator denied). Owned by the frontend, so it does not depend on the
 * backend wording.
 *
 * @type {string}
 */
export const USER_DENIED_MESSAGE = 'This account has been denied access.';

/** Login-modal messages keyed by the backend's `error.code`, overriding `error.message`. */
const MESSAGES = new Map([
  ['USER_DENIED', USER_DENIED_MESSAGE],
]);

/**
 * Maps a failed password-login error to the message the login modal shows. A plain object
 * module, so specs can spy on it.
 */
const LoginErrorMessages = {
  /**
   * Pick the submit-error message for a failed password login.
   *
   * @description A known `error.code` (e.g. `USER_DENIED`) maps to its own message; any other
   *   error keeps its own `message` (so a wrong password stays the usual credentials error).
   * @param {{code?: string, message: string}} error - The rejected login's error (usually an
   *   `ApiError`).
   * @returns {string} The message to show.
   */
  forLogin(error) {
    return MESSAGES.get(error?.code) ?? error.message;
  },
};

export default LoginErrorMessages;
