import { contextHash } from '../../../../../utils/context/ownerContext.js';
import TodoItemsHelper from './TodoItemsHelper.jsx';

/**
 * Render the Rename link, offered only to a role that may manage lists.
 *
 * @param {object} state - Show state (`list`, `context`, `perms`).
 * @returns {React.ReactElement|null} The link, or `null`.
 */
function renderRenameLink(state) {
  if (!state.perms.canManage) {
    return null;
  }

  return (
    <a className="btn btn-outline-primary" href={contextHash(state.context, `/todo/lists/${state.list.id}/edit`)}>
      Rename
    </a>
  );
}

/**
 * Render the Delete list button, offered only to a role that may delete.
 *
 * @param {object} state - Show state (`perms`, `pending`).
 * @param {{onDeleteList: Function}} handlers - Show handlers.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderDeleteListButton(state, handlers) {
  if (!state.perms.canDelete) {
    return null;
  }

  return (
    <button type="button" className="btn btn-outline-danger" disabled={state.pending} onClick={handlers.onDeleteList}>
      Delete list
    </button>
  );
}

/**
 * Render the action error alert, if any.
 *
 * @param {string|null} actionError - The last action's error message.
 * @returns {React.ReactElement|null} The alert, or `null`.
 */
function renderActionError(actionError) {
  if (!actionError) {
    return null;
  }

  return <div className="alert alert-danger" role="alert">{actionError}</div>;
}

/**
 * Render the loaded list: header with controls, action error, items and the add form.
 *
 * @param {object} state - Show state.
 * @param {object} handlers - Show handlers.
 * @returns {React.ReactElement} The list.
 */
function renderList(state, handlers) {
  return (
    <>
      <p><a href={contextHash(state.context, '/todo/lists')}>All lists</a></p>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="text-break">{state.list.name}</h1>
        <div className="d-flex gap-2">
          {renderRenameLink(state)}
          {renderDeleteListButton(state, handlers)}
        </div>
      </div>
      {renderActionError(state.actionError)}
      {TodoItemsHelper.renderItems(state, handlers)}
      {TodoItemsHelper.renderAddForm(state, handlers)}
    </>
  );
}

/**
 * Render the body: an error, a loading notice, or the list.
 *
 * @param {object} state - Show state.
 * @param {object} handlers - Show handlers.
 * @returns {React.ReactElement} The page body.
 */
function renderBody(state, handlers) {
  if (state.loadError) {
    return <div className="alert alert-danger">{state.loadError}</div>;
  }

  if (!state.list) {
    return <p className="text-muted">Loading…</p>;
  }

  return renderList(state, handlers);
}

/**
 * Rendering helper for the todo list show page.
 */
const TodoListShowHelper = {
  /**
   * Render the list show page.
   *
   * @param {{list: (object|null), loadError: (string|null), actionError: (string|null),
   *   pending: boolean, context: object,
   *   perms: {canManage: boolean, canDelete: boolean, canWrite: boolean},
   *   newDescription: string, editing: ({id: number, description: string}|null)}} state -
   *   Show state; `list` is `null` while loading.
   * @param {{onDeleteList: Function, onToggleItem: Function, onStartEdit: Function,
   *   onEditChange: Function, onSaveEdit: Function, onCancelEdit: Function,
   *   onDeleteItem: Function, onNewDescriptionChange: Function, onAddItem: Function}}
   *   handlers - Event handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return <div className="container mt-4">{renderBody(state, handlers)}</div>;
  },
};

export default TodoListShowHelper;
