import { useCallback, useMemo, useState } from 'react';
import HeaderHelper from './helpers/HeaderHelper.jsx';
import HeaderController from './controllers/HeaderController.js';
import useAuthEffect from './hooks/useAuthEffect.js';
import AuthSession from '../../../client/AuthSession.js';
import AwaitingApprovalGate from '../awaitingApproval/AwaitingApprovalGate.jsx';

/**
 * Application header, wrapping the current page's content. Shows a Login link when logged
 * out, or a Logout action when logged in — driven by state kept in sync with the shared
 * `AuthEvents` bus (via {@link useAuthEffect}), so it reacts to any auth-state change
 * independently of a page redirect, not just read from `AuthSession` at render time. `isAdmin`
 * always starts `false` — unlike `loggedIn`, there is no `AuthSession`-equivalent synchronous
 * local check for admin status, so it is only known once `checkStatus()` resolves. `pending`
 * (a session awaiting admin approval) also starts `false`; while it is set, the nav shows no auth
 * links and the page content is replaced by the Awaiting-approval view
 * ({@link AwaitingApprovalGate}).
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} [props.children] - Current page content, rendered below the nav bar
 *   (unless pending).
 * @returns {React.ReactElement} The rendered header and page content.
 */
export default function Header({ children }) {
  const controller = useMemo(() => new HeaderController(), []);
  const [loggedIn, setLoggedIn] = useState(AuthSession.isLoggedIn());
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState(false);
  const setters = useMemo(() => ({ setLoggedIn, setIsAdmin, setPending }), []);

  useAuthEffect(controller, setters);

  const handleLogout = useCallback((event) => {
    event.preventDefault();
    return controller.handleLogout();
  }, [controller]);

  const handleOpenLogin = (mode) => controller.openLoginModal(mode);

  return (
    <>
      {HeaderHelper.render(loggedIn, isAdmin, handleLogout, handleOpenLogin, pending)}
      <AwaitingApprovalGate pending={pending} onLogout={handleLogout}>
        {children}
      </AwaitingApprovalGate>
    </>
  );
}
