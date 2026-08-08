const LOGIN_MODAL_TOGGLE_EVENT = 'login-modal:toggle';

/**
 * Shared `window`-event bus for opening/closing the login modal. Wraps a single `CustomEvent`
 * type so any component — the header, `ApiClient`'s session-expired handling, or otherwise,
 * present or future — can request the modal open or closed independently, with zero coupling
 * to whichever component/controller renders it. A plain object module, matching
 * {@link module:client/ApiClient}'s style.
 */
const LoginModalEvents = {
  /**
   * Ask every current subscriber to open the login modal in a given mode.
   *
   * @param {string} mode - Which mode the modal should open in (e.g. `'password'`,
   *   `'register'`).
   * @param {object} [detail] - Optional extra detail merged into the event payload.
   * @returns {void} Nothing.
   */
  open(mode, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(LOGIN_MODAL_TOGGLE_EVENT, { detail: { open: true, mode, ...detail } }),
    );
  },

  /**
   * Ask every current subscriber to close the login modal.
   *
   * @returns {void} Nothing.
   */
  close() {
    window.dispatchEvent(new CustomEvent(LOGIN_MODAL_TOGGLE_EVENT, { detail: { open: false } }));
  },

  /**
   * Subscribe to login-modal toggle requests.
   *
   * @param {Function} handler - Called with the `CustomEvent` whose `detail.open` carries the
   *   requested state and `detail.mode` the requested mode.
   * @returns {void} Nothing.
   */
  subscribe(handler) {
    window.addEventListener(LOGIN_MODAL_TOGGLE_EVENT, handler);
  },

  /**
   * Unsubscribe from login-modal toggle requests.
   *
   * @param {Function} handler - The handler previously passed to
   *   {@link LoginModalEvents.subscribe}.
   * @returns {void} Nothing.
   */
  unsubscribe(handler) {
    window.removeEventListener(LOGIN_MODAL_TOGGLE_EVENT, handler);
  },
};

export default LoginModalEvents;
