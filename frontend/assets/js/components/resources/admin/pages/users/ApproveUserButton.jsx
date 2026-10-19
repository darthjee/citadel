/**
 * Approve button for a row of the Admin Users table.
 *
 * @description Renders only for `pending` users, so the page never offers an approval the API
 * would refuse (`422 USER_NOT_PENDING`).
 * @param {object} props - Component props.
 * @param {{id: number, status: string}} props.user - The row's user account.
 * @param {Function} props.onApprove - Click handler, already bound to the row's user.
 * @returns {React.ReactElement|null} The Approve button, or `null` when the user is not pending.
 */
export default function ApproveUserButton({ user, onApprove }) {
  if (user.status !== 'pending') {
    return null;
  }

  return (
    <button type="button" className="btn btn-sm btn-success me-2" onClick={onApprove}>
      Approve
    </button>
  );
}
