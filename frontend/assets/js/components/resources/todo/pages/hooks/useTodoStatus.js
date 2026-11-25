import { useMemo, useState } from 'react';
import { TODO_STATUS } from '../TodoGate.jsx';

/**
 * Track the blocking status of a todo page (Not-found or Forbidden).
 *
 * @returns {{status: (string|null), onNotFound: Function, onForbidden: Function}} The current
 *   status (`null` when not blocked) and stable callbacks setting it.
 */
export default function useTodoStatus() {
  const [status, setStatus] = useState(null);
  const callbacks = useMemo(() => ({
    onNotFound: () => setStatus(TODO_STATUS.NOT_FOUND),
    onForbidden: () => setStatus(TODO_STATUS.FORBIDDEN),
  }), []);

  return { status, ...callbacks };
}
