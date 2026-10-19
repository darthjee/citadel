import AwaitingApproval from './AwaitingApproval.jsx';

/**
 * Gate in front of the page content: renders the {@link AwaitingApproval} view while the
 * stored session is pending admin approval, and the given children otherwise.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.pending - Whether the session is awaiting admin approval.
 * @param {Function} props.onLogout - The header's logout handler, used by the view.
 * @param {React.ReactNode} [props.children] - Page content, shown when not pending.
 * @returns {React.ReactElement} The awaiting-approval view or the page content.
 */
export default function AwaitingApprovalGate({ pending, onLogout, children }) {
  if (pending) {
    return <AwaitingApproval onLogout={onLogout} />;
  }

  return <>{children}</>;
}
