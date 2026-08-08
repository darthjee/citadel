import { useEffect } from 'react';
import LoginModalEvents from '../../client/LoginModalEvents.js';
import { redirectHome } from '../../utils/routing/redirects.js';

/**
 * Open the login modal in the given mode and rewrite the URL hash to `#/`. Extracted from the
 * component's `useEffect` so it can be exercised directly in specs without a React renderer —
 * mirroring {@link module:components/AppController}'s `buildEffect`.
 *
 * @param {string} mode - Mode to open the login modal in (`'password'` or `'register'`).
 * @returns {void} Nothing.
 */
export function redirectToModal(mode) {
  LoginModalEvents.open(mode);

  redirectHome();
}

/**
 * Legacy-route shim rendered for the old `#/login` / `#/register` page keys: on mount it opens
 * the login modal in the matching mode and sends the URL back to `#/`, so stale bookmarks land
 * on the modal over the home page instead of a dead route. Renders nothing itself.
 *
 * @param {object} props - Component props.
 * @param {string} props.mode - Mode to open the login modal in (`'password'` or `'register'`).
 * @returns {null} Renders nothing.
 */
export default function ModalRedirect({ mode }) {
  useEffect(() => redirectToModal(mode), [mode]);

  return null;
}
