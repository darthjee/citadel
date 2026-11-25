import TodoListShowHelper from '../../../../../../../../assets/js/components/resources/todo/pages/helpers/TodoListShowHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const ORG = { kind: 'organization', orgId: 5 };
const LIST = {
  id: 3,
  name: 'Groceries',
  items: [{ id: 1, description: 'Milk', done: false }, { id: 2, description: 'Eggs', done: true }],
};
const ALL = { canManage: true, canDelete: true, canWrite: true };
const NONE = { canManage: false, canDelete: false, canWrite: false };
const USER = { canManage: false, canDelete: false, canWrite: true };

const noop = () => undefined;
const HANDLERS = {
  onDeleteList: noop,
  onToggleItem: noop,
  onStartEdit: noop,
  onEditChange: noop,
  onSaveEdit: noop,
  onCancelEdit: noop,
  onDeleteItem: noop,
  onNewDescriptionChange: noop,
  onAddItem: noop,
};

const render = (state) => renderedOutput(TodoListShowHelper.render({
  list: LIST,
  loadError: null,
  actionError: null,
  pending: false,
  context: ORG,
  perms: ALL,
  newDescription: '',
  editing: null,
  ...state,
}, HANDLERS));

describe('TodoListShowHelper', () => {
  it('renders the loading state', () => {
    expect(render({ list: null }).contains('Loading')).toBeTrue();
  });

  it('renders the load error', () => {
    expect(render({ list: null, loadError: 'boom' }).containsElement('div', 'boom')).toBeTrue();
  });

  it('renders the list name and its items in order', () => {
    const page = render({});

    expect(page.containsElement('h1', 'Groceries')).toBeTrue();
    expect(page.containsInOrder('Milk', 'Eggs')).toBeTrue();
  });

  it('links back to the list index in the context', () => {
    expect(render({}).containsAttribute('href', '#/orgs/5/todo/lists')).toBeTrue();
  });

  it('shows every control to an owner or admin', () => {
    const page = render({});

    expect(page.containsAttribute('href', '#/orgs/5/todo/lists/3/edit')).toBeTrue();
    expect(page.contains('Delete list')).toBeTrue();
    expect(page.containsElement('button', 'Edit')).toBeTrue();
    expect(page.containsElement('button', 'Delete')).toBeTrue();
    expect(page.contains('Add item')).toBeTrue();
  });

  it('shows a user the toggle, edit and add controls only', () => {
    const page = render({ perms: USER });

    expect(page.contains('Rename')).toBeFalse();
    expect(page.contains('Delete list')).toBeFalse();
    expect(page.containsElement('button', 'Delete')).toBeFalse();
    expect(page.containsElement('button', 'Edit')).toBeTrue();
    expect(page.contains('Add item')).toBeTrue();
    expect(page.contains('readOnly')).toBeFalse();
  });

  it('shows no controls while the role is unknown', () => {
    const page = render({ perms: NONE });

    expect(page.contains('Rename')).toBeFalse();
    expect(page.contains('Delete')).toBeFalse();
    expect(page.containsElement('button', 'Edit')).toBeFalse();
    expect(page.contains('Add item')).toBeFalse();
  });

  it('renders the action error', () => {
    const page = render({ actionError: "Delete the list's items first" });

    expect(page.contains('Delete the list&#x27;s items first')).toBeTrue();
  });

  it('renders the empty state', () => {
    expect(render({ list: { ...LIST, items: [] } }).contains('No items yet.')).toBeTrue();
  });
});
