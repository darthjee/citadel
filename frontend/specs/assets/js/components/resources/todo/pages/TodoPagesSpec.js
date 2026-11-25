import React from 'react';
import TodoLists from '../../../../../../../assets/js/components/resources/todo/pages/TodoLists.jsx';
import TodoListNew from '../../../../../../../assets/js/components/resources/todo/pages/TodoListNew.jsx';
import TodoListEdit from '../../../../../../../assets/js/components/resources/todo/pages/TodoListEdit.jsx';
import TodoListShow from '../../../../../../../assets/js/components/resources/todo/pages/TodoListShow.jsx';
import TodoListsHelper from '../../../../../../../assets/js/components/resources/todo/pages/helpers/TodoListsHelper.jsx';
import TodoListFormHelper from '../../../../../../../assets/js/components/resources/todo/pages/helpers/TodoListFormHelper.jsx';
import TodoListShowHelper from '../../../../../../../assets/js/components/resources/todo/pages/helpers/TodoListShowHelper.jsx';
import TodoListFormController from '../../../../../../../assets/js/components/resources/todo/pages/controllers/TodoListFormController.js';
import TodoListController from '../../../../../../../assets/js/components/resources/todo/pages/controllers/TodoListController.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';
import { itGatesThePageByRole } from '../../../../../../support/roleGatedPageExamples.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

const ORG = { kind: 'organization', orgId: 5 };
const PERSONAL = { kind: 'personal' };

function inContext(Page, value = {}) {
  return React.createElement(
    OwnerContext.Provider,
    {
      value: {
        ...DEFAULT_OWNER_CONTEXT, context: ORG, userId: 1, role: 'owner', ...value,
      },
    },
    React.createElement(Page),
  );
}

function capture(Page, Helper, value) {
  let captured;

  spyOn(Helper, 'render').and.callFake((state, handlers, options) => {
    captured = { state, handlers, options };
    return React.createElement('div');
  });
  renderedOutput(inContext(Page, value));

  return captured;
}

const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('todo pages', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('TodoLists', () => {
    it('renders the loading state of the context lists', () => {
      const { state } = capture(TodoLists, TodoListsHelper);

      expect(state).toEqual({
        lists: null, loadError: null, context: ORG, canManage: true,
      });
    });

    it('hides New list from a user', () => {
      expect(capture(TodoLists, TodoListsHelper, { role: 'user' }).state.canManage).toBeFalse();
    });

    it('shows New list to an admin', () => {
      expect(capture(TodoLists, TodoListsHelper, { role: 'admin' }).state.canManage).toBeTrue();
    });

    it('renders the page heading', () => {
      expect(renderedOutput(inContext(TodoLists)).containsElement('h1', 'Todo lists')).toBeTrue();
    });
  });

  describe('TodoListNew', () => {
    itGatesThePageByRole({ Page: TodoListNew, Helper: TodoListFormHelper, loadingWhileUnknown: false });

    it('renders the create form, cancelling to the context index', () => {
      const { options } = capture(TodoListNew, TodoListFormHelper, { context: PERSONAL });

      expect(options).toEqual(jasmine.objectContaining({ heading: 'New list', cancelHref: '#/todo/lists' }));
    });

    it('submits the context and the current name', async () => {
      spyOn(TodoListFormController.prototype, 'handleCreate').and.resolveTo();
      const { handlers } = capture(TodoListNew, TodoListFormHelper);
      const event = fakeEvent();

      await handlers.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(TodoListFormController.prototype.handleCreate).toHaveBeenCalledWith(ORG, { name: '' });
    });

    it('wires the name field change handler', () => {
      const { handlers } = capture(TodoListNew, TodoListFormHelper);

      expect(() => handlers.onChange({ target: { value: 'x' } })).not.toThrow();
    });
  });

  describe('TodoListEdit', () => {
    itGatesThePageByRole({
      Page: TodoListEdit, Helper: TodoListFormHelper, hash: '#/orgs/5/todo/lists/3/edit', loadingWhileUnknown: false,
    });

    describe('with a list id', () => {
      beforeEach(() => {
        installFakeWindow({ location: { hash: '#/orgs/5/todo/lists/3/edit' } });
      });

      it('renders the rename form, cancelling to the list', () => {
        const { options } = capture(TodoListEdit, TodoListFormHelper);

        expect(options).toEqual(jasmine.objectContaining({
          heading: 'Rename list', cancelHref: '#/orgs/5/todo/lists/3',
        }));
      });

      it('submits the context, the list id and the current name', async () => {
        spyOn(TodoListFormController.prototype, 'handleRename').and.resolveTo();
        const { handlers } = capture(TodoListEdit, TodoListFormHelper);

        await handlers.onSubmit(fakeEvent());

        expect(TodoListFormController.prototype.handleRename).toHaveBeenCalledWith(ORG, 3, { name: '' });
      });

      it('wires the name field change handler', () => {
        const { handlers } = capture(TodoListEdit, TodoListFormHelper);

        expect(() => handlers.onChange({ target: { value: 'x' } })).not.toThrow();
      });
    });

    it('renders Not-found for a malformed id', () => {
      installFakeWindow({ location: { hash: '#/orgs/5/todo/lists/abc/edit' } });

      expect(renderedOutput(inContext(TodoListEdit)).containsElement('h1', 'Not found')).toBeTrue();
    });
  });

  describe('TodoListShow', () => {
    describe('with a list id', () => {
      beforeEach(() => {
        installFakeWindow({ location: { hash: '#/orgs/5/todo/lists/3' } });
      });

      it('renders the loading state of the list', () => {
        const { state } = capture(TodoListShow, TodoListShowHelper);

        expect(state).toEqual(jasmine.objectContaining({
          list: null, listId: 3, context: ORG, editing: null, newDescription: '',
        }));
      });

      [
        ['owner', { canManage: true, canDelete: true, canWrite: true }],
        ['admin', { canManage: true, canDelete: true, canWrite: true }],
        ['user', { canManage: false, canDelete: false, canWrite: true }],
        [null, { canManage: false, canDelete: false, canWrite: false }],
      ].forEach(([role, perms]) => {
        it(`computes the controls of a ${role} role`, () => {
          expect(capture(TodoListShow, TodoListShowHelper, { role }).state.perms).toEqual(perms);
        });
      });

      it('wires the handlers to the controller', () => {
        spyOn(TodoListController.prototype, 'deleteList').and.resolveTo();
        const { handlers } = capture(TodoListShow, TodoListShowHelper);

        handlers.onDeleteList();

        expect(TodoListController.prototype.deleteList).toHaveBeenCalledWith(ORG, 3);
      });
    });

    it('renders Not-found for a malformed id', () => {
      installFakeWindow({ location: { hash: '#/todo/lists/007' } });

      expect(renderedOutput(inContext(TodoListShow)).containsElement('h1', 'Not found')).toBeTrue();
    });
  });
});
