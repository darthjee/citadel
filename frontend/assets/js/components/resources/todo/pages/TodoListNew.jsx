import { useMemo, useState } from 'react';
import useOwnerContext from '../../../common/ownerContext/hooks/useOwnerContext.js';
import { ACTIONS } from '../../../../utils/permissions/orgPermissions.js';
import { contextHash } from '../../../../utils/context/ownerContext.js';
import TodoGate from './TodoGate.jsx';
import useTodoStatus from './hooks/useTodoStatus.js';
import roleGate from './controllers/roleGate.js';
import TodoListFormController from './controllers/TodoListFormController.js';
import TodoListFormHelper from './helpers/TodoListFormHelper.jsx';

/**
 * New todo list page (`#/todo/lists/new`, `#/orgs/:orgId/todo/lists/new`): a name form
 * creating a list in the active context, then going to its show page. A role that may not
 * manage lists sees the permission message; nothing is rendered while the role is unknown.
 *
 * @returns {React.ReactElement|null} The rendered page.
 */
export default function TodoListNew() {
  const { context, role } = useOwnerContext();
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);
  const { status, onNotFound, onForbidden } = useTodoStatus();
  const controller = useMemo(() => new TodoListFormController({
    setFieldErrors, setSubmitError, setPending, onNotFound, onForbidden,
  }), [onNotFound, onForbidden]);

  const handlers = {
    onChange: (event) => setName(event.target.value),
    onSubmit: (event) => {
      event.preventDefault();
      return controller.handleCreate(context, { name });
    },
  };
  const options = {
    heading: 'New list',
    submitLabel: 'Create',
    idPrefix: 'todo-list-new-',
    cancelHref: contextHash(context, '/todo/lists'),
  };

  return (
    <TodoGate
      status={status}
      allowed={roleGate(role, ACTIONS.MANAGE_LISTS)}
      render={() => TodoListFormHelper.render({
        name, fieldErrors, submitError, pending,
      }, handlers, options)}
    />
  );
}
