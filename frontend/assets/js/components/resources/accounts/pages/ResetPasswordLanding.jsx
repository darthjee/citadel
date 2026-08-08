import { useEffect } from 'react';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';
import { redirectHome } from '../../../../utils/routing/redirects.js';

/**
 * Extract the `token` query parameter from a hash-based route, SSR/spec-safe. A one-off parse
 * local to this landing — `Router#extractParams` handles path params (e.g. `/games/:id`), not
 * query strings.
 *
 * @param {string} [hash] - The hash to parse; defaults to the current `window.location.hash`,
 *   or `''` when `window` is not defined (e.g. during a Node-based spec run).
 * @returns {string|null} The `token` query parameter, or `null` when absent.
 */
function getTokenFromHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const queryString = hash.split('?')[1] || '';
  return new URLSearchParams(queryString).get('token');
}

/**
 * Open the login modal in `resetPassword` mode with the recovery token read from the current
 * hash, then rewrite the URL hash to `#/`. Extracted from the component's `useEffect` so it can
 * be exercised directly in specs without a React renderer — mirroring
 * {@link module:components/common/ModalRedirect}'s `redirectToModal`.
 *
 * @returns {void} Nothing.
 */
export function redirectToResetModal() {
  LoginModalEvents.open('resetPassword', { token: getTokenFromHash() });

  redirectHome();
}

/**
 * Landing for `#/recover-password?token=…`: on mount it opens the login modal in
 * Set-new-password mode carrying the hash's recovery token, then sends the URL back to `#/`, so
 * the recovery link lands on the modal over the home page instead of a dedicated page. Renders
 * nothing itself.
 *
 * @returns {null} Renders nothing.
 */
export default function ResetPasswordLanding() {
  useEffect(() => redirectToResetModal(), []);

  return null;
}
