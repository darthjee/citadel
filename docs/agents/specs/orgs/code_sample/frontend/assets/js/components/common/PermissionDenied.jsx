/** The single permission-denied text shown wherever the caller's role forbids an action. */
export const PERMISSION_DENIED_MESSAGE = "You don't have permission to do this";

/**
 * Generic permission-denied view, shown in place of a page the caller's role cannot use.
 *
 * @returns {React.ReactElement} The rendered permission message.
 */
export default function PermissionDenied() {
  return (
    <div className="container mt-4">
      <div className="alert alert-warning" role="alert">{PERMISSION_DENIED_MESSAGE}</div>
    </div>
  );
}
