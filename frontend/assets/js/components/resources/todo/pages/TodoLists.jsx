import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../common/ownerContext/hooks/useOwnerContext.js';
import useCan from '../../../common/ownerContext/hooks/useCan.js';
import { ACTIONS } from '../../../../utils/permissions/orgPermissions.js';
import TodoGate from './TodoGate.jsx';
import useTodoStatus from './hooks/useTodoStatus.js';
import TodoLoader, { buildTodoLoadEffect } from './controllers/TodoLoader.js';
import TodoListsHelper from './helpers/TodoListsHelper.jsx';

/**
 * Todo list index page (`#/todo/lists`, `#/orgs/:orgId/todo/lists`): the lists of the active
 * context's owner, fetched on each visit, with a "New list" button for a role that may manage
 * lists. A `404` shows the Not-found view, a `403` the permission message.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function TodoLists() {
  const { context } = useOwnerContext();
  const canManage = useCan(ACTIONS.MANAGE_LISTS);
  const [lists, setLists] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const { status, onNotFound, onForbidden } = useTodoStatus();
  const loader = useMemo(() => new TodoLoader(), []);

  useEffect(() => buildTodoLoadEffect((isActive) => loader.loadLists(context, {
    onLoaded: setLists, onNotFound, onForbidden, onError: setLoadError,
  }, isActive))(), [loader, context, onNotFound, onForbidden]);

  return (
    <TodoGate
      status={status}
      render={() => TodoListsHelper.render({
        lists, loadError, context, canManage,
      })}
    />
  );
}
