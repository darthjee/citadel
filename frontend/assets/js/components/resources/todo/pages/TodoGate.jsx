import NotFound from '../../../common/notFound/NotFound.jsx';
import PermissionDenied from '../../../common/PermissionDenied.jsx';

/** Blocking outcomes of a todo page request. */
export const TODO_STATUS = Object.freeze({
  NOT_FOUND: 'not-found',
  FORBIDDEN: 'forbidden',
});

/**
 * Gate in front of a todo page's content.
 *
 * @description A `NOT_FOUND` status renders the Not-found view and a `FORBIDDEN` status the
 * permission message. Otherwise `allowed` gates on the caller's role: `null` (role not yet
 * known) renders nothing, `false` renders the permission message, and `true` renders the
 * content. The content is only built (`render()` called) when shown.
 * @param {object} props - Component props.
 * @param {string|null} [props.status] - One of {@link TODO_STATUS}, or `null` when not blocked.
 * @param {boolean|null} [props.allowed] - Whether the caller's role may use the page; `null`
 *   while the role is unknown.
 * @param {Function} props.render - Builds the page content.
 * @returns {React.ReactElement|null} The gated content.
 */
export default function TodoGate({ status = null, allowed = true, render }) {
  if (status === TODO_STATUS.NOT_FOUND) {
    return <NotFound />;
  }

  if (status === TODO_STATUS.FORBIDDEN || allowed === false) {
    return <PermissionDenied />;
  }

  if (allowed === null) {
    return null;
  }

  return render();
}
