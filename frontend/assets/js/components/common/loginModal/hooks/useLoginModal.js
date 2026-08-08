import { useEffect } from 'react';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';

/**
 * Build the mount-time login-modal effect: subscribes to the shared `LoginModalEvents` bus so
 * any live `LoginModalEvents.open(...)` / `LoginModalEvents.close()` — from the header,
 * `ApiClient`'s session-expired handling, or any other future caller — drives the modal's
 * open/mode state. On an open request it also stores the reset token carried in the event
 * detail, clears any lingering result panel, and asks the controller to switch mode, which
 * resets the form. On a close request, and again on cleanup, it also tears down any running
 * authorization-request poller via `controller.stopPoller()` (null-safe), so a device request
 * in flight leaves no live timer once the modal goes away. Returns a cleanup function that
 * unsubscribes and guards against calling the setters once cleanup has already run. Extracted
 * as a plain function, separate from the `useEffect` call itself, so it can be exercised
 * directly in tests without a React renderer — mirroring
 * {@link module:components/common/header/hooks/useAuthEffect}'s `buildAuthEffect`.
 *
 * @param {{switchMode: Function, stopPoller: Function}} controller - Controller exposing
 *   `switchMode(mode)` and `stopPoller()` methods.
 * @param {{setOpen: Function, setResetToken: Function, setResultPanel: Function}} setters -
 *   React state setters for the modal's open flag, the reset token, and the result panel.
 * @returns {Function} Effect callback, returning a cleanup function.
 */
export function buildLoginModalEffect(controller, { setOpen, setResetToken, setResultPanel }) {
  return () => {
    let mounted = true;

    const handleToggle = (event) => {
      if (!mounted) return;

      const detail = event.detail ?? {};
      setOpen(Boolean(detail.open));

      if (detail.open) {
        setResetToken(detail.token ?? '');
        setResultPanel(null);
        controller.switchMode(detail.mode);
      } else {
        controller.stopPoller();
      }
    };

    LoginModalEvents.subscribe(handleToggle);

    return () => {
      mounted = false;
      LoginModalEvents.unsubscribe(handleToggle);
      controller.stopPoller();
    };
  };
}

/**
 * Keep the login modal's `open` / `mode` / reset-token / result-panel state in sync with the
 * shared `LoginModalEvents` bus. See {@link buildLoginModalEffect} for the effect's behavior.
 *
 * @param {{switchMode: Function, stopPoller: Function}} controller - Controller exposing
 *   `switchMode(mode)` and `stopPoller()` methods.
 * @param {{setOpen: Function, setResetToken: Function, setResultPanel: Function}} setters -
 *   React state setters for the modal's open flag, the reset token, and the result panel.
 * @returns {void} Nothing.
 */
export default function useLoginModal(controller, setters) {
  useEffect(() => buildLoginModalEffect(controller, setters)(), [controller, setters]);
}
