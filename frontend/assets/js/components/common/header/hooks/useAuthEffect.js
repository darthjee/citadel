import { useEffect } from 'react';
import AuthEvents from '../../../../client/AuthEvents.js';

/**
 * Build the mount-time auth effect: subscribes to the shared `AuthEvents` bus (so any live
 * `AuthEvents.emit(...)` — from a login, a logout, or any other future component — updates
 * state), then triggers `controller.checkStatus()`'s own mount-time confirmation, whose emit is
 * what ultimately drives the first update. Returns a cleanup function that unsubscribes and
 * guards against calling the setters once cleanup has already run (e.g. a fast unmount before
 * `checkStatus()` resolves). Extracted as a plain function, separate from the `useEffect` call
 * itself, so it can be exercised directly in tests without a React renderer — mirroring
 * {@link module:components/AppController}'s `buildEffect()`.
 *
 * @param {{checkStatus: Function}} controller - Controller exposing a `checkStatus()` method.
 * @param {{setLoggedIn: Function, setIsAdmin: Function}} setters - React state setters for the
 *   current auth state.
 * @returns {Function} Effect callback, returning a cleanup function.
 */
export function buildAuthEffect(controller, { setLoggedIn, setIsAdmin }) {
  return () => {
    let mounted = true;

    const handleAuthChanged = (event) => {
      if (!mounted) return;

      setLoggedIn(Boolean(event.detail?.loggedIn));
      setIsAdmin(Boolean(event.detail?.isAdmin));
    };

    AuthEvents.subscribe(handleAuthChanged);
    controller.checkStatus();

    return () => {
      mounted = false;
      AuthEvents.unsubscribe(handleAuthChanged);
    };
  };
}

/**
 * Keep `loggedIn`/`isAdmin` state variables in sync with the shared `AuthEvents` bus, confirmed
 * at mount time via `controller.checkStatus()`. See {@link buildAuthEffect} for the effect's
 * behavior.
 *
 * @param {{checkStatus: Function}} controller - Controller exposing a `checkStatus()` method.
 * @param {{setLoggedIn: Function, setIsAdmin: Function}} setters - React state setters for the
 *   current auth state.
 * @returns {void} Nothing.
 */
export default function useAuthEffect(controller, setters) {
  useEffect(() => buildAuthEffect(controller, setters)(), [controller, setters]);
}
