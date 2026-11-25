import TodoListController from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/TodoListController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

const ORG = { kind: 'organization', orgId: 5 };
const LIST = { id: 3, name: 'L', items: [{ id: 1, description: 'a', done: false }] };

describe('TodoListController', () => {
  let deps;
  let controller;
  let list;

  beforeEach(() => {
    list = LIST;
    deps = {
      setList: jasmine.createSpy('setList').and.callFake((update) => {
        list = update(list);
      }),
      setActionError: jasmine.createSpy('setActionError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      onForbidden: jasmine.createSpy('onForbidden'),
      navigate: jasmine.createSpy('navigate'),
      confirm: jasmine.createSpy('confirm').and.returnValue(true),
      client: jasmine.createSpyObj('client', ['deleteList', 'createItem', 'updateItem', 'deleteItem']),
    };
    controller = new TodoListController(deps);
  });

  describe('.deleteList', () => {
    it('deletes after confirmation and goes to the list index', async () => {
      deps.client.deleteList.and.resolveTo({});

      await controller.deleteList(ORG, 3);

      expect(deps.confirm).toHaveBeenCalled();
      expect(deps.client.deleteList).toHaveBeenCalledWith(ORG, 3);
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/todo/lists');
      expect(deps.setPending.calls.allArgs()).toEqual([[true], [false]]);
    });

    it('does nothing when not confirmed', async () => {
      deps.confirm.and.returnValue(false);

      await controller.deleteList(ORG, 3);

      expect(deps.client.deleteList).not.toHaveBeenCalled();
    });

    it('stays on the page with a message on 409 LIST_HAS_ITEMS', async () => {
      deps.client.deleteList.and.rejectWith(new ApiError(409, 'List has items', 'LIST_HAS_ITEMS'));

      await controller.deleteList(ORG, 3);

      expect(deps.setActionError).toHaveBeenCalledWith("Delete the list's items first");
      expect(deps.navigate).not.toHaveBeenCalled();
      expect(deps.setPending).toHaveBeenCalledWith(false);
    });

    it('reports a 404 as not found', async () => {
      deps.client.deleteList.and.rejectWith(new ApiError(404, 'Not found'));

      await controller.deleteList(ORG, 3);

      expect(deps.onNotFound).toHaveBeenCalled();
    });

    it('reports a 403 as forbidden', async () => {
      deps.client.deleteList.and.rejectWith(new ApiError(403, 'Forbidden'));

      await controller.deleteList(ORG, 3);

      expect(deps.onForbidden).toHaveBeenCalled();
    });
  });

  describe('.addItem', () => {
    it('creates the trimmed item and appends it', async () => {
      deps.client.createItem.and.resolveTo({ id: 2, description: 'b', done: false });

      const added = await controller.addItem(ORG, 3, ' b ');

      expect(added).toBeTrue();
      expect(deps.client.createItem).toHaveBeenCalledWith(ORG, 3, { description: 'b' });
      expect(list.items.map(({ id }) => id)).toEqual([1, 2]);
    });

    it('validates the description', async () => {
      const added = await controller.addItem(ORG, 3, ' ');

      expect(added).toBeFalse();
      expect(deps.setActionError).toHaveBeenCalledWith('Description is required');
      expect(deps.client.createItem).not.toHaveBeenCalled();
    });

    it('shows a 400 message', async () => {
      deps.client.createItem.and.rejectWith(new ApiError(400, 'description too long', 'VALIDATION_FAILED'));

      const added = await controller.addItem(ORG, 3, 'b');

      expect(added).toBeFalse();
      expect(deps.setActionError).toHaveBeenCalledWith('description too long');
    });

    it('shows nothing on a session-expired rejection', async () => {
      deps.client.createItem.and.rejectWith(sessionExpiredError());

      await controller.addItem(ORG, 3, 'b');

      expect(deps.setActionError).not.toHaveBeenCalledWith(jasmine.any(String));
    });
  });

  describe('.toggleItem', () => {
    it('sends the flipped done flag and replaces the item', async () => {
      deps.client.updateItem.and.resolveTo({ id: 1, description: 'a', done: true });

      const toggled = await controller.toggleItem(ORG, 3, LIST.items[0]);

      expect(toggled).toBeTrue();
      expect(deps.client.updateItem).toHaveBeenCalledWith(ORG, 3, 1, { done: true });
      expect(list.items[0].done).toBeTrue();
    });

    it('sends done: false when unchecking', async () => {
      deps.client.updateItem.and.resolveTo({ id: 1, description: 'a', done: false });

      await controller.toggleItem(ORG, 3, { id: 1, done: true });

      expect(deps.client.updateItem).toHaveBeenCalledWith(ORG, 3, 1, { done: false });
    });
  });

  describe('.saveDescription', () => {
    it('sends the trimmed description and replaces the item', async () => {
      deps.client.updateItem.and.resolveTo({ id: 1, description: 'z', done: false });

      const saved = await controller.saveDescription(ORG, 3, 1, ' z ');

      expect(saved).toBeTrue();
      expect(deps.client.updateItem).toHaveBeenCalledWith(ORG, 3, 1, { description: 'z' });
      expect(list.items[0].description).toBe('z');
    });

    it('validates the description', async () => {
      const saved = await controller.saveDescription(ORG, 3, 1, '');

      expect(saved).toBeFalse();
      expect(deps.client.updateItem).not.toHaveBeenCalled();
    });
  });

  describe('.deleteItem', () => {
    it('deletes after confirmation and removes the item', async () => {
      deps.client.deleteItem.and.resolveTo({});

      const deleted = await controller.deleteItem(ORG, 3, 1);

      expect(deleted).toBeTrue();
      expect(deps.client.deleteItem).toHaveBeenCalledWith(ORG, 3, 1);
      expect(list.items).toEqual([]);
    });

    it('does nothing when not confirmed', async () => {
      deps.confirm.and.returnValue(false);

      const deleted = await controller.deleteItem(ORG, 3, 1);

      expect(deleted).toBeFalse();
      expect(deps.client.deleteItem).not.toHaveBeenCalled();
    });

    it('treats an undefined answer as done', async () => {
      deps.client.deleteItem.and.resolveTo(undefined);

      expect(await controller.deleteItem(ORG, 3, 1)).toBeTrue();
    });
  });

  describe('default confirmation', () => {
    afterEach(() => uninstallFakeWindow());

    it('asks window.confirm', async () => {
      const confirm = jasmine.createSpy('confirm').and.returnValue(false);
      const rest = { ...deps, confirm: undefined };

      installFakeWindow({ confirm });
      await new TodoListController(rest).deleteList(ORG, 3);

      expect(confirm).toHaveBeenCalledWith('Delete this list?');
      expect(deps.client.deleteList).not.toHaveBeenCalled();
    });

    it('confirms nothing without a window', async () => {
      const rest = { ...deps, confirm: undefined };

      installFakeWindow(undefined);
      await new TodoListController(rest).deleteItem(ORG, 3, 1);

      expect(deps.client.deleteItem).not.toHaveBeenCalled();
    });
  });

  it('uses the real client and navigation by default', () => {
    const rest = { ...deps, client: undefined, navigate: undefined };

    expect(() => new TodoListController(rest)).not.toThrow();
  });
});
