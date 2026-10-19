/**
 * Deny button for a row of the Admin Users table.
 *
 * @description Hidden on the calling admin's own row (`422 CANNOT_DENY_SELF`) and on rows already
 * denied, so the page never offers a denial the API would refuse. The confirmation dialog lives
 * in `AdminUsersController#handleDeny`; this button only calls `onDeny`.
 * @param {object} props - Component props.
 * @param {{id: number, status: string}} props.user - The row's user account.
 * @param {(number|null)} props.currentUserId - The calling admin's own user id.
 * @param {Function} props.onDeny - Click handler, already bound to the row's user.
 * @returns {React.ReactElement|null} The Deny button, or `null` when denying is not allowed.
 */
export default function DenyUserButton({ user, currentUserId, onDeny }) {
  if (user.id === currentUserId || user.status === 'denied') {
    return null;
  }

  return (
    <button type="button" className="btn btn-sm btn-danger me-2" onClick={onDeny}>
      Deny
    </button>
  );
}
