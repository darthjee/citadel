/**
 * Build the event handlers of the todo list show page.
 *
 * @description Wires the page's UI events to the {@link TodoListController} actions: the add
 * form is cleared once its item is created, and the inline editor is closed once its
 * description is saved. Exported as a plain function so specs can drive the handlers without a
 * React renderer.
 * @param {object} controller - The show-page controller.
 * @param {{context: object, listId: number, newDescription: string,
 *   editing: ({id: number, description: string}|null)}} state - The current page state.
 * @param {{setNewDescription: Function, setEditing: Function}} setters - React state setters.
 * @returns {object} The handlers expected by `TodoListShowHelper.render`.
 */
export default function buildShowHandlers(controller, state, { setNewDescription, setEditing }) {
  const { context, listId, editing } = state;

  return {
    onDeleteList: () => controller.deleteList(context, listId),
    onToggleItem: (item) => controller.toggleItem(context, listId, item),
    onDeleteItem: (item) => controller.deleteItem(context, listId, item.id),
    onStartEdit: (item) => setEditing({ id: item.id, description: item.description }),
    onEditChange: (event) => setEditing({ ...editing, description: event.target.value }),
    onCancelEdit: () => setEditing(null),
    onSaveEdit: async (event) => {
      event.preventDefault();

      if (await controller.saveDescription(context, listId, editing.id, editing.description)) {
        setEditing(null);
      }
    },
    onNewDescriptionChange: (event) => setNewDescription(event.target.value),
    onAddItem: async (event) => {
      event.preventDefault();

      if (await controller.addItem(context, listId, state.newDescription)) {
        setNewDescription('');
      }
    },
  };
}
