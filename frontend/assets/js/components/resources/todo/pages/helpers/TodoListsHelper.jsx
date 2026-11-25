import { contextHash } from '../../../../../utils/context/ownerContext.js';

/**
 * Render the "New list" button, offered only to a role that may manage lists.
 *
 * @param {object} context - The active owner context.
 * @param {boolean} canManage - Whether the caller's role may create lists.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderNewButton(context, canManage) {
  if (!canManage) {
    return null;
  }

  return <a className="btn btn-primary" href={contextHash(context, '/todo/lists/new')}>New list</a>;
}

/**
 * Render the table of lists.
 *
 * @param {Array<object>} lists - The lists.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The table.
 */
function renderTable(lists, context) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Items</th>
        </tr>
      </thead>
      <tbody>
        {lists.map((list) => (
          <tr key={list.id}>
            <td className="text-break">
              <a href={contextHash(context, `/todo/lists/${list.id}`)}>{list.name}</a>
            </td>
            <td>{list.items_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Render the body: an error, a loading notice, the empty state or the table.
 *
 * @param {{lists: (Array<object>|null), loadError: (string|null), context: object}} state -
 *   Page state.
 * @returns {React.ReactElement} The page body.
 */
function renderBody({ lists, loadError, context }) {
  if (loadError) {
    return <div className="alert alert-danger">{loadError}</div>;
  }

  if (!lists) {
    return <p className="text-muted">Loading…</p>;
  }

  if (lists.length === 0) {
    return <p className="text-muted">No lists yet.</p>;
  }

  return renderTable(lists, context);
}

/**
 * Rendering helper for the todo list index page.
 */
const TodoListsHelper = {
  /**
   * Render the list index.
   *
   * @param {{lists: (Array<object>|null), loadError: (string|null), context: object,
   *   canManage: boolean}} state - The loaded lists (`null` while loading), the load error, the
   *   active owner context and whether the caller's role may create lists.
   * @returns {React.ReactElement} The rendered index.
   */
  render(state) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1>Todo lists</h1>
          {renderNewButton(state.context, state.canManage)}
        </div>
        {renderBody(state)}
      </div>
    );
  },
};

export default TodoListsHelper;
