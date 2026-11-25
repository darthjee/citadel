import TodoListFormHelper from '../../../../../../../../assets/js/components/resources/todo/pages/helpers/TodoListFormHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const OPTIONS = {
  heading: 'New list', submitLabel: 'Create', idPrefix: 'todo-list-new-', cancelHref: '#/todo/lists',
};
const HANDLERS = { onSubmit: () => undefined, onChange: () => undefined };

const render = (state) => renderedOutput(TodoListFormHelper.render({
  name: '', fieldErrors: {}, submitError: null, pending: false, ...state,
}, HANDLERS, OPTIONS));

describe('TodoListFormHelper', () => {
  it('renders the heading, the name field, the submit button and the cancel link', () => {
    const page = render({ name: 'Groceries' });

    expect(page.containsElement('h1', 'New list')).toBeTrue();
    expect(page.containsAttribute('id', 'todo-list-new-name')).toBeTrue();
    expect(page.containsAttribute('value', 'Groceries')).toBeTrue();
    expect(page.containsElement('button', 'Create')).toBeTrue();
    expect(page.containsAttribute('href', '#/todo/lists')).toBeTrue();
  });

  it('renders the name field error', () => {
    expect(render({ fieldErrors: { name: 'Name is required' } }).contains('Name is required')).toBeTrue();
  });

  it('renders the submit error', () => {
    expect(render({ submitError: 'boom' }).containsElement('div', 'boom')).toBeTrue();
  });

  it('disables the submit button while pending', () => {
    expect(render({ pending: true }).contains('disabled')).toBeTrue();
  });
});
