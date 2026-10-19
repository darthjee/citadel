import Button from 'react-bootstrap/cjs/Button.js';
import Container from 'react-bootstrap/cjs/Container.js';

/**
 * Render the status re-check error alert, if any.
 *
 * @param {{error: (string|null)}} state - View state.
 * @returns {React.ReactElement|null} The error alert, or `null` when there is none.
 */
function renderError(state) {
  if (!state.error) {
    return null;
  }

  return <div className="alert alert-danger">{state.error}</div>;
}

/**
 * Rendering helper for the Awaiting-approval view.
 */
const AwaitingApprovalHelper = {
  /**
   * Render the Awaiting-approval view.
   *
   * @param {{error: (string|null)}} state - View state.
   * @param {{onCheckAgain: Function, onLogout: Function}} handlers - Click handlers for the
   *   Check again and Log out buttons.
   * @returns {React.ReactElement} The rendered view.
   */
  render(state, handlers) {
    return (
      <Container className="mt-4">
        <h1>Awaiting approval</h1>
        <p>Your account is waiting for an administrator&apos;s approval.</p>
        {renderError(state)}
        <Button variant="primary" className="me-2" onClick={handlers.onCheckAgain}>
          Check again
        </Button>
        <Button variant="secondary" onClick={handlers.onLogout}>Log out</Button>
      </Container>
    );
  },
};

export default AwaitingApprovalHelper;
