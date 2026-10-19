import { useCallback, useMemo, useState } from 'react';
import AwaitingApprovalController from './controllers/AwaitingApprovalController.js';
import AwaitingApprovalHelper from './helpers/AwaitingApprovalHelper.jsx';
import useWindowFocusRecheck from './hooks/useWindowFocusRecheck.js';

/**
 * Awaiting-approval view, shown instead of the page content while the stored session belongs
 * to a user still awaiting admin approval. Re-checks the account status on Check again and on
 * window focus (never on a timer); Log out uses the header's logout handler.
 *
 * @param {object} props - Component props.
 * @param {Function} props.onLogout - The header's logout handler.
 * @returns {React.ReactElement} The rendered view.
 */
export default function AwaitingApproval({ onLogout }) {
  const [error, setError] = useState(null);
  const controller = useMemo(
    () => new AwaitingApprovalController(setError, onLogout),
    [onLogout],
  );
  const handleCheckAgain = useCallback(() => controller.checkAgain(), [controller]);
  const handleLogout = (event) => controller.logout(event);

  useWindowFocusRecheck(handleCheckAgain);

  return AwaitingApprovalHelper.render(
    { error },
    { onCheckAgain: handleCheckAgain, onLogout: handleLogout },
  );
}
