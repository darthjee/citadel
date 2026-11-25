import TodoListsHelper from '../../../../../../../../assets/js/components/resources/todo/pages/helpers/TodoListsHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const ORG = { kind: 'organization', orgId: 5 };
const LISTS = [{ id: 1, name: 'Groceries', items_count: 3 }, { id: 2, name: 'Chores', items_count: 0 }];

const render = (state) => renderedOutput(TodoListsHelper.render({
  lists: null, loadError: null, context: ORG, canManage: false, ...state,
}));

describe('TodoListsHelper', () => {
  it('renders the lists with their item counts, linking in the context', () => {
    const page = render({ lists: LISTS });

    expect(page.containsInOrder('Groceries', '3', 'Chores', '0')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/todo/lists/1')).toBeTrue();
  });

  it('renders Personal links in the Personal context', () => {
    const page = render({ lists: LISTS, context: { kind: 'personal' } });

    expect(page.containsAttribute('href', '#/todo/lists/2')).toBeTrue();
  });

  it('renders the empty state', () => {
    expect(render({ lists: [] }).contains('No lists yet.')).toBeTrue();
  });

  it('renders the loading state', () => {
    expect(render({}).contains('Loading')).toBeTrue();
  });

  it('renders the load error', () => {
    expect(render({ loadError: 'boom' }).containsElement('div', 'boom')).toBeTrue();
  });

  it('shows the New list button to a role that may manage lists', () => {
    const page = render({ lists: [], canManage: true });

    expect(page.containsAttribute('href', '#/orgs/5/todo/lists/new')).toBeTrue();
    expect(page.contains('New list')).toBeTrue();
  });

  it('hides the New list button otherwise', () => {
    expect(render({ lists: [] }).contains('New list')).toBeFalse();
  });
});
