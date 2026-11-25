/**
 * Render the inline description editor of the item being edited.
 *
 * @param {{editing: {id: number, description: string}, pending: boolean}} state - Show state.
 * @param {object} handlers - Show handlers (`onEditChange`, `onSaveEdit`, `onCancelEdit`).
 * @returns {React.ReactElement} The inline edit form.
 */
function renderEditor(state, handlers) {
  return (
    <form className="d-flex flex-grow-1 gap-2" onSubmit={handlers.onSaveEdit} noValidate>
      <input
        id={`todo-item-edit-${state.editing.id}`}
        type="text"
        className="form-control form-control-sm"
        aria-label="Description"
        value={state.editing.description}
        onChange={handlers.onEditChange}
      />
      <button type="submit" className="btn btn-sm btn-primary" disabled={state.pending}>Save</button>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handlers.onCancelEdit}>
        Cancel
      </button>
    </form>
  );
}

/**
 * Render an item's Edit button, offered only to a role that may write.
 *
 * @param {object} item - The item.
 * @param {object} state - Show state (`perms`, `pending`).
 * @param {object} handlers - Show handlers (`onStartEdit`).
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderEditButton(item, state, handlers) {
  if (!state.perms.canWrite) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      disabled={state.pending}
      onClick={() => handlers.onStartEdit(item)}
    >
      Edit
    </button>
  );
}

/**
 * Render an item's Delete button, offered only to a role that may delete, and hidden while the
 * item is being edited.
 *
 * @param {object} item - The item.
 * @param {boolean} editing - Whether the item is being edited.
 * @param {object} state - Show state (`perms`, `pending`).
 * @param {object} handlers - Show handlers (`onDeleteItem`).
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderDeleteButton(item, editing, state, handlers) {
  if (!state.perms.canDelete || editing) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-danger"
      disabled={state.pending}
      onClick={() => handlers.onDeleteItem(item)}
    >
      Delete
    </button>
  );
}

/**
 * Render an item's description, with its Edit button when the role may write.
 *
 * @param {object} item - The item.
 * @param {object} state - Show state (`perms`, `pending`).
 * @param {object} handlers - Show handlers (`onStartEdit`).
 * @returns {React.ReactElement} The description block.
 */
function renderDescription(item, state, handlers) {
  return (
    <>
      <span className={`flex-grow-1 text-break${item.done ? ' text-decoration-line-through' : ''}`}>
        {item.description}
      </span>
      {renderEditButton(item, state, handlers)}
    </>
  );
}

/**
 * Render an item's done checkbox: editable for a role that may write, read-only otherwise.
 *
 * @param {object} item - The item.
 * @param {object} state - Show state (`perms`, `pending`).
 * @param {object} handlers - Show handlers (`onToggleItem`).
 * @returns {React.ReactElement} The checkbox.
 */
function renderDone(item, state, handlers) {
  const { canWrite } = state.perms;

  return (
    <input
      type="checkbox"
      className="form-check-input mt-0"
      aria-label="Done"
      checked={item.done}
      readOnly={!canWrite}
      disabled={!canWrite || state.pending}
      onChange={canWrite ? () => handlers.onToggleItem(item) : undefined}
    />
  );
}

/**
 * Render one item row.
 *
 * @param {object} item - The item.
 * @param {object} state - Show state.
 * @param {object} handlers - Show handlers.
 * @returns {React.ReactElement} The row.
 */
function renderItem(item, state, handlers) {
  const editing = state.editing?.id === item.id;

  return (
    <li key={item.id} className="list-group-item d-flex align-items-center gap-2">
      {renderDone(item, state, handlers)}
      {editing ? renderEditor(state, handlers) : renderDescription(item, state, handlers)}
      {renderDeleteButton(item, editing, state, handlers)}
    </li>
  );
}

/**
 * Rendering helper for the items of the todo list show page: the item rows (with the done
 * checkbox, the inline description editor and the delete button) and the "Add item" form.
 * Controls are only rendered for a role allowed to use them.
 */
const TodoItemsHelper = {
  /**
   * Render the item rows, or an empty notice.
   *
   * @param {{list: object, perms: object, pending: boolean,
   *   editing: ({id: number, description: string}|null)}} state - Show state.
   * @param {object} handlers - Show handlers.
   * @returns {React.ReactElement} The items.
   */
  renderItems(state, handlers) {
    if (state.list.items.length === 0) {
      return <p className="text-muted">No items yet.</p>;
    }

    return (
      <ul className="list-group mb-3">
        {state.list.items.map((item) => renderItem(item, state, handlers))}
      </ul>
    );
  },

  /**
   * Render the "Add item" form, offered only to a role that may write.
   *
   * @param {{perms: object, pending: boolean, newDescription: string}} state - Show state.
   * @param {{onAddItem: Function, onNewDescriptionChange: Function}} handlers - Show handlers.
   * @returns {React.ReactElement|null} The form, or `null`.
   */
  renderAddForm(state, handlers) {
    if (!state.perms.canWrite) {
      return null;
    }

    return (
      <form className="d-flex gap-2" onSubmit={handlers.onAddItem} noValidate>
        <input
          id="todo-item-new-description"
          type="text"
          className="form-control"
          placeholder="New item"
          aria-label="New item description"
          value={state.newDescription}
          onChange={handlers.onNewDescriptionChange}
        />
        <button type="submit" className="btn btn-primary text-nowrap" disabled={state.pending}>Add item</button>
      </form>
    );
  },
};

export default TodoItemsHelper;
