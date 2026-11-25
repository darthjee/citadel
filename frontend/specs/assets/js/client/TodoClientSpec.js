import TodoClient from '../../../../assets/js/client/TodoClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

const CONTEXTS = [
  ['personal', PERSONAL, ''],
  ['organization', ORG, '/orgs/5'],
];

describe('TodoClient', () => {
  CONTEXTS.forEach(([label, context, prefix]) => {
    describe(`in the ${label} context`, () => {
      it('lists the lists', async () => {
        spyOn(ApiClient, 'getJson').and.resolveTo([{ id: 1, name: 'A', items_count: 2 }]);

        const lists = await TodoClient.listLists(context);

        expect(ApiClient.getJson).toHaveBeenCalledWith(`${prefix}/todo/lists.json`);
        expect(lists).toEqual([{ id: 1, name: 'A', items_count: 2 }]);
      });

      it('creates a list', async () => {
        spyOn(ApiClient, 'postJson').and.resolveTo({ id: 2, name: 'B' });

        const list = await TodoClient.createList(context, 'B');

        expect(ApiClient.postJson).toHaveBeenCalledWith(`${prefix}/todo/lists.json`, { name: 'B' });
        expect(list).toEqual({ id: 2, name: 'B' });
      });

      it('shows a list', async () => {
        spyOn(ApiClient, 'getJson').and.resolveTo({ id: 2, name: 'B', items: [] });

        await TodoClient.showList(context, 2);

        expect(ApiClient.getJson).toHaveBeenCalledWith(`${prefix}/todo/lists/2.json`);
      });

      it('renames a list', async () => {
        spyOn(ApiClient, 'patchJson').and.resolveTo({ id: 2, name: 'C' });

        await TodoClient.renameList(context, 2, 'C');

        expect(ApiClient.patchJson).toHaveBeenCalledWith(`${prefix}/todo/lists/2.json`, { name: 'C' });
      });

      it('deletes a list', async () => {
        spyOn(ApiClient, 'deleteJson').and.resolveTo({});

        await TodoClient.deleteList(context, 2);

        expect(ApiClient.deleteJson).toHaveBeenCalledWith(`${prefix}/todo/lists/2.json`);
      });

      it('creates an item, omitting an undefined done', async () => {
        spyOn(ApiClient, 'postJson').and.resolveTo({ id: 9 });

        await TodoClient.createItem(context, 2, { description: 'Milk' });

        expect(ApiClient.postJson).toHaveBeenCalledWith(`${prefix}/todo/lists/2/items.json`, { description: 'Milk' });
      });

      it('creates an item with done', async () => {
        spyOn(ApiClient, 'postJson').and.resolveTo({ id: 9 });

        await TodoClient.createItem(context, 2, { description: 'Milk', done: true });

        expect(ApiClient.postJson)
          .toHaveBeenCalledWith(`${prefix}/todo/lists/2/items.json`, { description: 'Milk', done: true });
      });

      it('updates an item with only the defined fields', async () => {
        spyOn(ApiClient, 'patchJson').and.resolveTo({ id: 9 });

        await TodoClient.updateItem(context, 2, 9, { description: 'Eggs' });

        expect(ApiClient.patchJson).toHaveBeenCalledWith(`${prefix}/todo/lists/2/items/9.json`, { description: 'Eggs' });
      });

      it('keeps done: false when updating an item', async () => {
        spyOn(ApiClient, 'patchJson').and.resolveTo({ id: 9, done: false });

        await TodoClient.updateItem(context, 2, 9, { done: false });

        expect(ApiClient.patchJson).toHaveBeenCalledWith(`${prefix}/todo/lists/2/items/9.json`, { done: false });
      });

      it('deletes an item', async () => {
        spyOn(ApiClient, 'deleteJson').and.resolveTo({});

        await TodoClient.deleteItem(context, 2, 9);

        expect(ApiClient.deleteJson).toHaveBeenCalledWith(`${prefix}/todo/lists/2/items/9.json`);
      });
    });
  });

  describe('against a 204 answer', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('resolves a list delete with an empty object, sending no body', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 204 }]);

      await expectAsync(TodoClient.deleteList(ORG, 2)).toBeResolvedTo({});

      const [path, options] = globalThis.fetch.calls.mostRecent().args;

      expect(path).toBe('/orgs/5/todo/lists/2.json');
      expect(options.method).toBe('DELETE');
      expect(options.body).toBeUndefined();
    });

    it('resolves an item delete with an empty object', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 204 }]);

      await expectAsync(TodoClient.deleteItem(PERSONAL, 2, 9)).toBeResolvedTo({});
    });
  });

  it('propagates failures', async () => {
    spyOn(ApiClient, 'getJson').and.rejectWith(new Error('boom'));

    await expectAsync(TodoClient.listLists(PERSONAL)).toBeRejectedWithError('boom');
  });
});
