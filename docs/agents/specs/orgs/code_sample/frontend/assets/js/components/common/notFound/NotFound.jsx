import { useEffect } from 'react';
import ContextStorage from '../../../utils/context/ContextStorage.js';
import useOwnerContext from '../ownerContext/hooks/useOwnerContext.js';

/**
 * Forget the user's remembered context when it is the organization found to be missing.
 *
 * @param {number|null} userId - The logged-in user id.
 * @param {number|null} orgId - The missing organization id, if any.
 * @param {object} [storage] - Context store override (default {@link ContextStorage}).
 * @returns {void} Nothing.
 */
export function forgetStaleContext(userId, orgId, storage = ContextStorage) {
  if (orgId) {
    storage.forgetIfMatches(userId, orgId);
  }
}

/**
 * Generic Not-found view. Identical for a malformed organization id and a backend 404, so it
 * never reveals whether an organization exists. When given the missing `orgId`, it also forgets
 * that id if it is the user's remembered context.
 *
 * @param {object} props - Component props.
 * @param {number|null} [props.orgId] - The organization id that answered 404, if any.
 * @returns {React.ReactElement} The rendered Not-found view.
 */
export default function NotFound({ orgId = null }) {
  const { userId } = useOwnerContext();

  useEffect(() => forgetStaleContext(userId, orgId), [userId, orgId]);

  return (
    <div className="container mt-4">
      <h1>Not found</h1>
      <p>The page you are looking for could not be found.</p>
      <a href="#/">Go to Personal</a>
    </div>
  );
}
