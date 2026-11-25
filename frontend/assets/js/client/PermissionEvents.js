const FORBIDDEN_EVENT = 'permission:forbidden';

/**
 * Shared `window`-event bus for permission denials. {@link module:client/ApiClient} announces
 * every `403 Forbidden` response here, so the owner context can refresh the caller's role
 * without any per-controller wiring. A plain object module, matching
 * {@link module:client/AuthEvents}'s style.
 */
const PermissionEvents = {
  /**
   * Announce a `403 Forbidden` response to every current subscriber.
   *
   * @description SSR/spec-safe: a no-op when `window` (or its `dispatchEvent`) is not
   * available.
   * @returns {void} Nothing.
   */
  emitForbidden() {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
      return;
    }

    window.dispatchEvent(new CustomEvent(FORBIDDEN_EVENT));
  },

  /**
   * Subscribe to permission denials.
   *
   * @param {Function} listener - Called with the `CustomEvent` on each `403` response.
   * @returns {Function} Unsubscribes the listener.
   */
  onForbidden(listener) {
    window.addEventListener(FORBIDDEN_EVENT, listener);

    return () => window.removeEventListener(FORBIDDEN_EVENT, listener);
  },
};

export default PermissionEvents;
