import Table from 'react-bootstrap/cjs/Table.js';

/**
 * Render the list-load error alert, if any.
 *
 * @param {{loadError: (string|null)}} state - Page state.
 * @returns {React.ReactElement|null} The error alert, or `null` when there is none.
 */
function renderLoadError(state) {
  if (!state.loadError) {
    return null;
  }

  return <div className="alert alert-danger">{state.loadError}</div>;
}

/**
 * Render the open-requests table, or an empty-state message when there are none.
 *
 * @param {{requests: Array<object>, rowState: Map}} state - Page state.
 * @param {{onToggleAuthorize: Function, onPasswordChange: Function,
 *   onConfirmAuthorize: Function, onDeny: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered table or empty-state message.
 */
function renderRequestsTable(state, handlers) {
  if (state.requests.length === 0) {
    return <p>No pending authorization requests.</p>;
  }

  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>IP</th>
          <th>User-Agent</th>
          <th>Age</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {state.requests.map(
          (request) => renderRow(request, state.rowState, handlers),
        )}
      </tbody>
    </Table>
  );
}

/**
 * Render a single request row, with its Deny/Authorize actions and whatever row-level error
 * the controller is currently holding for it.
 *
 * @param {{uuid: string, requestIp: string, requestUserAgent: string,
 *   createdAt: string}} request - The row's authorization request.
 * @param {Map} rowState - The per-request row UI state map, keyed by request uuid.
 * @param {{onToggleAuthorize: Function, onPasswordChange: Function,
 *   onConfirmAuthorize: Function, onDeny: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered row.
 */
function renderRow(request, rowState, handlers) {
  const row = rowState.get(request.uuid) ?? {};

  return (
    <tr key={request.uuid}>
      <td>{request.requestIp}</td>
      <td>{request.requestUserAgent}</td>
      <td>{formatAge(request.createdAt)}</td>
      <td>
        {renderActions(request, row, handlers)}
        {renderRowError(row)}
      </td>
    </tr>
  );
}

/**
 * Render a row's actions: a Deny button, plus either an Authorize toggle button or (once
 * toggled open) an inline password field with a Confirm button.
 *
 * @param {{uuid: string}} request - The row's authorization request.
 * @param {{open: boolean, password: string}} row - The row's current UI state.
 * @param {{onToggleAuthorize: Function, onPasswordChange: Function,
 *   onConfirmAuthorize: Function, onDeny: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The rendered actions.
 */
function renderActions(request, row, handlers) {
  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-danger me-2"
        onClick={handlers.onDeny(request.uuid)}
      >
        Deny
      </button>
      {row.open
        ? renderAuthorizeForm(request, row, handlers)
        : (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handlers.onToggleAuthorize(request.uuid)}
          >
            Authorize
          </button>
        )}
    </>
  );
}

/**
 * Render the inline password confirmation form for a row toggled into authorize mode.
 *
 * @param {{uuid: string}} request - The row's authorization request.
 * @param {{password: string}} row - The row's current UI state.
 * @param {{onPasswordChange: Function, onConfirmAuthorize: Function}} handlers - Event
 *   handlers.
 * @returns {React.ReactElement} The rendered inline form.
 */
function renderAuthorizeForm(request, row, handlers) {
  return (
    <form
      className="d-inline-flex align-items-center gap-2"
      onSubmit={handlers.onConfirmAuthorize(request.uuid)}
    >
      <input
        type="password"
        className="form-control form-control-sm"
        placeholder="Password"
        value={row.password ?? ''}
        onChange={handlers.onPasswordChange(request.uuid)}
      />
      <button type="submit" className="btn btn-sm btn-primary">Confirm</button>
    </form>
  );
}

/**
 * Render a row's last-action error, if any.
 *
 * @param {{error: (string|null)}} row - The row's current UI state.
 * @returns {React.ReactElement|null} The error message, or `null` when there is none.
 */
function renderRowError(row) {
  if (!row.error) {
    return null;
  }

  return <div className="text-danger mt-1">{row.error}</div>;
}

/**
 * Compute a human-readable "age" for an authorization request, from its creation timestamp
 * to now: whole minutes elapsed (e.g. `"5 min ago"`), or `"just now"` under a minute — the
 * request TTL is short enough (defaulting to 1 hour) that hour/day granularity is never
 * needed.
 *
 * @param {string} createdAt - The request's ISO-8601 creation timestamp.
 * @returns {string} The formatted age.
 */
function formatAge(createdAt) {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  return minutes < 1 ? 'just now' : `${minutes} min ago`;
}

/**
 * Rendering helper for the "My account → Authorizations" page.
 */
const AuthorizationRequestsHelper = {
  /**
   * Render the Authorization Requests page: a list of the caller's own open authorization
   * requests, each with Deny/Authorize actions.
   *
   * @param {{requests: Array<object>, loadError: (string|null), rowState: Map}} state - Page
   *   state.
   * @param {{onToggleAuthorize: Function, onPasswordChange: Function,
   *   onConfirmAuthorize: Function, onDeny: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered Authorization Requests page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Authorization Requests</h1>
        {renderLoadError(state)}
        {renderRequestsTable(state, handlers)}
      </div>
    );
  },
};

export default AuthorizationRequestsHelper;
