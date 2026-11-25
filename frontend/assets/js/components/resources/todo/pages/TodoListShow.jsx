import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../common/ownerContext/hooks/useOwnerContext.js';
import { ACTIONS, can } from '../../../../utils/permissions/orgPermissions.js';
import TodoGate, { TODO_STATUS } from './TodoGate.jsx';
import useTodoStatus from './hooks/useTodoStatus.js';
import listIdFrom from './controllers/listId.js';
import buildShowHandlers from './controllers/showHandlers.js';
import TodoLoader, { buildTodoLoadEffect } from './controllers/TodoLoader.js';
import TodoListController from './controllers/TodoListController.js';
import TodoListShowHelper from './helpers/TodoListShowHelper.jsx';

/**
 * Compute which controls the caller's role may use.
 *
 * @param {string|null} role - The caller's role (`null` while unknown: nothing is allowed).
 * @returns {{canManage: boolean, canDelete: boolean, canWrite: boolean}} The permissions.
 */
function permsFor(role) {
  return {
    canManage: can(role, ACTIONS.MANAGE_LISTS),
    canDelete: can(role, ACTIONS.DELETE),
    canWrite: can(role, ACTIONS.WRITE),
  };
}

/**
 * Todo list show page (`#/todo/lists/:id`, `#/orgs/:orgId/todo/lists/:id`): the list name with
 * its Rename / Delete list controls, its items (done checkbox, inline description edit, delete)
 * and an "Add item" form. Controls the caller's role may not use are hidden. A malformed id or
 * a `404` shows the Not-found view; a `403` the permission message.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function TodoListShow() {
  const { context, role } = useOwnerContext();
  const listId = listIdFrom('/todo/lists/:id');
  const [list, setList] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [pending, setPending] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [editing, setEditing] = useState(null);
  const { status, onNotFound, onForbidden } = useTodoStatus();
  const loader = useMemo(() => new TodoLoader(), []);
  const controller = useMemo(() => new TodoListController({
    setList, setActionError, setPending, onNotFound, onForbidden,
  }), [onNotFound, onForbidden]);

  useEffect(() => buildTodoLoadEffect((isActive) => listId && loader.loadList(context, listId, {
    onLoaded: setList, onNotFound, onForbidden, onError: setLoadError,
  }, isActive))(), [loader, context, listId, onNotFound, onForbidden]);

  const state = {
    list, loadError, actionError, pending, context, listId, newDescription, editing,
    perms: permsFor(role),
  };
  const handlers = buildShowHandlers(controller, state, { setNewDescription, setEditing });

  return (
    <TodoGate
      status={listId ? status : TODO_STATUS.NOT_FOUND}
      render={() => TodoListShowHelper.render(state, handlers)}
    />
  );
}
