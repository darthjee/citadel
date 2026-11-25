import TodoLoader, { buildTodoLoadEffect } from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/TodoLoader.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

const ORG = { kind: 'organization', orgId: 5 };

describe('TodoLoader', () => {
  let client;
  let callbacks;
  let loader;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['listLists', 'showList']);
    callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onForbidden', 'onError']);
    loader = new TodoLoader(client);
  });

  describe('.loadLists', () => {
    it('reports the loaded lists', async () => {
      client.listLists.and.resolveTo([{ id: 1 }]);

      await loader.loadLists(ORG, callbacks);

      expect(client.listLists).toHaveBeenCalledWith(ORG);
      expect(callbacks.onLoaded).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('reports a 404 as not found', async () => {
      client.listLists.and.rejectWith(new ApiError(404, 'Not found'));

      await loader.loadLists(ORG, callbacks);

      expect(callbacks.onNotFound).toHaveBeenCalled();
    });
  });

  describe('.loadList', () => {
    it('reports the loaded list', async () => {
      client.showList.and.resolveTo({ id: 3, items: [] });

      await loader.loadList(ORG, 3, callbacks);

      expect(client.showList).toHaveBeenCalledWith(ORG, 3);
      expect(callbacks.onLoaded).toHaveBeenCalledWith({ id: 3, items: [] });
    });

    it('reports a 403 as forbidden', async () => {
      client.showList.and.rejectWith(new ApiError(403, 'Forbidden'));

      await loader.loadList(ORG, 3, callbacks);

      expect(callbacks.onForbidden).toHaveBeenCalled();
    });

    it('reports other failures with their message', async () => {
      client.showList.and.rejectWith(new ApiError(500, 'boom'));

      await loader.loadList(ORG, 3, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith('boom');
    });

    it('reports nothing on a session-expired rejection', async () => {
      client.showList.and.rejectWith(sessionExpiredError());

      await loader.loadList(ORG, 3, callbacks);

      Object.values(callbacks).forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });

    it('drops a late answer', async () => {
      client.showList.and.resolveTo({ id: 3 });

      await loader.loadList(ORG, 3, callbacks, () => false);

      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });

    it('drops a late failure', async () => {
      client.showList.and.rejectWith(new ApiError(404, 'Not found'));

      await loader.loadList(ORG, 3, callbacks, () => false);

      expect(callbacks.onNotFound).not.toHaveBeenCalled();
    });
  });

  it('uses the real client by default', () => {
    expect(() => new TodoLoader()).not.toThrow();
  });
});

describe('buildTodoLoadEffect', () => {
  it('starts the load with a liveness check that the cleanup turns off', () => {
    const load = jasmine.createSpy('load');

    const cleanup = buildTodoLoadEffect(load)();
    const isActive = load.calls.mostRecent().args[0];

    expect(isActive()).toBeTrue();
    cleanup();
    expect(isActive()).toBeFalse();
  });
});
