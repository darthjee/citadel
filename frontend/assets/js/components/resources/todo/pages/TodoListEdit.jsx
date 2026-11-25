import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../common/ownerContext/hooks/useOwnerContext.js';
import { ACTIONS } from '../../../../utils/permissions/orgPermissions.js';
import { contextHash } from '../../../../utils/context/ownerContext.js';
import TodoGate, { TODO_STATUS } from './TodoGate.jsx';
import useTodoStatus from './hooks/useTodoStatus.js';
import listIdFrom from './controllers/listId.js';
import roleGate from './controllers/roleGate.js';
import TodoLoader, { buildTodoLoadEffect } from './controllers/TodoLoader.js';
import TodoListFormController from './controllers/TodoListFormController.js';
import TodoListFormHelper from './helpers/TodoListFormHelper.jsx';

/**
 * Rename todo list page (`#/todo/lists/:id/edit`, `#/orgs/:orgId/todo/lists/:id/edit`):
 * prefilled from a fetch on visit; saving goes back to the show page. A malformed id or a `404`
 * shows the Not-found view; a role that may not manage lists (or a `403`) sees the permission
 * message; nothing is rendered while the role is unknown.
 *
 * @returns {React.ReactElement|null} The rendered page.
 */
export default function TodoListEdit() {
  const { context, role } = useOwnerContext();
  const listId = listIdFrom('/todo/lists/:id/edit');
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);
  const { status, onNotFound, onForbidden } = useTodoStatus();
  const loader = useMemo(() => new TodoLoader(), []);
  const controller = useMemo(() => new TodoListFormController({
    setFieldErrors, setSubmitError, setPending, onNotFound, onForbidden,
  }), [onNotFound, onForbidden]);

  useEffect(() => buildTodoLoadEffect((isActive) => listId && loader.loadList(context, listId, {
    onLoaded: (list) => setName(list.name), onNotFound, onForbidden, onError: setSubmitError,
  }, isActive))(), [loader, context, listId, onNotFound, onForbidden]);

  const handlers = {
    onChange: (event) => setName(event.target.value),
    onSubmit: (event) => {
      event.preventDefault();
      return controller.handleRename(context, listId, { name });
    },
  };
  const options = {
    heading: 'Rename list',
    submitLabel: 'Save',
    idPrefix: 'todo-list-edit-',
    cancelHref: contextHash(context, `/todo/lists/${listId}`),
  };

  return (
    <TodoGate
      status={listId ? status : TODO_STATUS.NOT_FOUND}
      allowed={roleGate(role, ACTIONS.MANAGE_LISTS)}
      render={() => TodoListFormHelper.render({
        name, fieldErrors, submitError, pending,
      }, handlers, options)}
    />
  );
}
