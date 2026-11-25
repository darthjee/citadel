import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import {
  ALICE,
  ALICE_ORG,
  base,
  BOB,
  BOB_ORG,
  buildTodoTestApp,
  createItem,
  createList,
  send,
  TODO_SETUP_TIMEOUT_MS,
  type TodoTestApp,
  withoutTimestamp,
} from './support/build-todo-test-app.js';
import {
  createOwnerFixtures,
  ITEM_NOT_FOUND_CASES,
  NOT_FOUND_CASES,
  ORG_MEMBERS,
  ownerKeysIn,
  type OwnerFixtures,
  seedOrgRoles,
  UNIFORM_403,
  UNIFORM_404,
} from './support/owner-matrix.js';
import { expectValidationErrorBody } from '../../auth/tests/support/error-body.js';

const LIST_KEYS = ['created_at', 'id', 'name', 'updated_at'];
const SUMMARY_KEYS = ['created_at', 'id', 'items_count', 'name', 'updated_at'];
const DETAIL_KEYS = ['created_at', 'id', 'items', 'name', 'updated_at'];
const ITEM_KEYS = ['created_at', 'description', 'done', 'id', 'updated_at'];
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const CONTEXTS: Array<[string, number | null]> = [
  ['personal', null],
  ['organization', ALICE_ORG],
];

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

// Every 2xx body must be free of owner fields (and `list_id`).
function expectNoOwnerKeys(response: request.Response): void {
  expect(ownerKeysIn(response.body)).toEqual([]);
}

describe('TodoController (e2e)', () => {
  let app: INestApplication;
  let harness: TodoTestApp;
  let fixtures: OwnerFixtures;

  beforeAll(async () => {
    harness = await buildTodoTestApp();
    ({ app } = harness);
    seedOrgRoles(harness.seedMembership);
    fixtures = await createOwnerFixtures(app);
  }, TODO_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('CRUD in the %s context', (_label, orgId) => {
    it('creates, lists, shows, renames and deletes a list with its items', async () => {
      const created = await send(app, 'post', `${base(orgId)}/lists.json`, ALICE, { name: '  Chores  ' }).expect(201);
      expect(keysOf(created.body)).toEqual(LIST_KEYS);
      expect(created.body.name).toBe('Chores');
      expect(created.body.created_at).toMatch(ISO_TIMESTAMP);
      expectNoOwnerKeys(created);
      const id = created.body.id as number;

      const item = await send(app, 'post', `${base(orgId)}/lists/${id}/items.json`, ALICE, { description: 'Dishes' })
        .expect(201);
      expect(keysOf(item.body)).toEqual(ITEM_KEYS);
      expect(item.body).toEqual(expect.objectContaining({ description: 'Dishes', done: false }));
      expectNoOwnerKeys(item);

      const index = await send(app, 'get', `${base(orgId)}/lists.json`, ALICE).expect(200);
      const summary = (index.body as Array<Record<string, unknown>>).find((row) => row.id === id)!;
      expect(keysOf(summary)).toEqual(SUMMARY_KEYS);
      expect(summary.items_count).toBe(1);
      expectNoOwnerKeys(index);

      const show = await send(app, 'get', `${base(orgId)}/lists/${id}.json`, ALICE).expect(200);
      expect(keysOf(show.body)).toEqual(DETAIL_KEYS);
      expect(show.body.items).toHaveLength(1);
      expect(keysOf(show.body.items[0])).toEqual(ITEM_KEYS);
      expectNoOwnerKeys(show);

      const patchedItem = await send(app, 'patch', `${base(orgId)}/lists/${id}/items/${item.body.id}.json`, ALICE, {
        done: true,
      }).expect(200);
      expect(patchedItem.body).toEqual(expect.objectContaining({ description: 'Dishes', done: true }));
      expectNoOwnerKeys(patchedItem);

      const renamed = await send(app, 'patch', `${base(orgId)}/lists/${id}.json`, ALICE, { name: 'Housework' })
        .expect(200);
      expect(keysOf(renamed.body)).toEqual(LIST_KEYS);
      expect(renamed.body.name).toBe('Housework');
      expectNoOwnerKeys(renamed);

      const deletedItem = await send(app, 'delete', `${base(orgId)}/lists/${id}/items/${item.body.id}.json`, ALICE)
        .expect(204);
      expect(deletedItem.text).toBe('');

      const deletedList = await send(app, 'delete', `${base(orgId)}/lists/${id}.json`, ALICE).expect(204);
      expect(deletedList.text).toBe('');
      await send(app, 'get', `${base(orgId)}/lists/${id}.json`, ALICE).expect(404);
    });

    it('serves GET lists.json from the index route (not lists/:id.json)', async () => {
      const response = await send(app, 'get', `${base(orgId)}/lists.json`, ALICE).expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('orders lists and items by id', async () => {
      const first = await createList(app, ALICE, orgId, 'First');
      const second = await createList(app, ALICE, orgId, 'Second');
      const a = await createItem(app, ALICE, orgId, first.id, 'a');
      const b = await createItem(app, ALICE, orgId, first.id, 'b');

      const index = await send(app, 'get', `${base(orgId)}/lists.json`, ALICE).expect(200);
      const ids = (index.body as Array<{ id: number }>).map((row) => row.id);
      expect(ids).toEqual([...ids].sort((x, y) => x - y));
      expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));

      const show = await send(app, 'get', `${base(orgId)}/lists/${first.id}.json`, ALICE).expect(200);
      expect((show.body.items as Array<{ id: number }>).map((row) => row.id)).toEqual([a.id, b.id]);
    });
  });

  describe('owner isolation', () => {
    it('never counts or shows another owner\'s items', async () => {
      const index = await send(app, 'get', `${base(null)}/lists.json`, ALICE).expect(200);
      const ids = (index.body as Array<{ id: number }>).map((row) => row.id);

      expect(ids).toContain(fixtures.alicePersonal);
      expect(ids).not.toContain(fixtures.bobPersonal);
      expect(ids).not.toContain(fixtures.aliceOrg);
      expect((index.body as Array<{ id: number; items_count: number }>).find((row) => row.id === fixtures.alicePersonal)
        ?.items_count).toBe(1);

      const show = await send(app, 'get', `${base(null)}/lists/${fixtures.alicePersonal}.json`, ALICE).expect(200);
      expect((show.body.items as Array<{ id: number }>).map((row) => row.id)).toEqual([fixtures.items.alicePersonal]);
    });

    it('lists only the organization\'s lists in its context', async () => {
      const index = await send(app, 'get', `${base(ALICE_ORG)}/lists.json`, ORG_MEMBERS.user).expect(200);
      const ids = (index.body as Array<{ id: number }>).map((row) => row.id);

      expect(ids).toContain(fixtures.aliceOrg);
      expect(ids).not.toContain(fixtures.alicePersonal);
      expect(ids).not.toContain(fixtures.bobOrg);
    });
  });

  describe('the uniform 404 on lists', () => {
    const operations: Array<[string, 'get' | 'patch' | 'delete', object | undefined]> = [
      ['show', 'get', undefined],
      ['rename', 'patch', { name: 'Hijacked' }],
      ['delete', 'delete', undefined],
    ];

    describe.each(operations)('on %s', (_op, method, body) => {
      it.each(NOT_FOUND_CASES)('for $label', async ({ user, orgId, listId }) => {
        const response = await send(app, method, `${base(orgId)}/lists/${listId(fixtures)}.json`, user, body)
          .expect(404);

        expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
        expect(response.headers['x-cache-invalidate']).toBeUndefined();
      });
    });

    it.each(NOT_FOUND_CASES)('on item create for $label', async ({ user, orgId, listId }) => {
      const response = await send(app, 'post', `${base(orgId)}/lists/${listId(fixtures)}/items.json`, user, {
        description: 'Hijack',
      }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('leaves another owner\'s list untouched', async () => {
      expect(harness.lists.rows.find((row) => row.id === fixtures.bobPersonal)?.name).toBe('Bob personal');
    });
  });

  describe('the uniform 404 on items', () => {
    const operations: Array<[string, 'patch' | 'delete', object | undefined]> = [
      ['update', 'patch', { done: true }],
      ['delete', 'delete', undefined],
    ];

    describe.each(operations)('on %s', (_op, method, body) => {
      it.each(ITEM_NOT_FOUND_CASES)('for $label', async ({ orgId, listId, itemId }) => {
        const path = `${base(orgId)}/lists/${listId(fixtures)}/items/${itemId(fixtures)}.json`;
        const response = await send(app, method, path, ALICE, body).expect(404);

        expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
      });

      it.each(NOT_FOUND_CASES)('for a list that is $label', async ({ user, orgId, listId }) => {
        const path = `${base(orgId)}/lists/${listId(fixtures)}/items/${fixtures.items.bobOrg}.json`;
        const response = await send(app, method, path, user, body).expect(404);

        expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
      });
    });

    it('leaves the items untouched', () => {
      const fixtureItems = harness.items.rows.filter((row) => Object.values(fixtures.items).includes(row.id));

      expect(fixtureItems).toHaveLength(4);
      expect(fixtureItems.every((row) => row.done === false)).toBe(true);
    });
  });

  describe('deleting a list', () => {
    it('answers 409 LIST_HAS_ITEMS while it has items, and 204 once emptied', async () => {
      const list = await createList(app, ALICE, null);
      const item = await createItem(app, ALICE, null, list.id);

      const conflict = await send(app, 'delete', `${base(null)}/lists/${list.id}.json`, ALICE).expect(409);
      expect(withoutTimestamp(conflict)).toEqual({
        error: { code: 'LIST_HAS_ITEMS', message: 'List has items' },
        statusCode: 409,
      });
      expect(conflict.headers['x-cache-invalidate']).toBeUndefined();

      await send(app, 'delete', `${base(null)}/lists/${list.id}/items/${item.id}.json`, ALICE).expect(204);
      await send(app, 'delete', `${base(null)}/lists/${list.id}.json`, ALICE).expect(204);
    });

    it.each([
      ['another user\'s', null, (f: OwnerFixtures) => f.bobPersonal],
      ['another organization\'s', ALICE_ORG, (f: OwnerFixtures) => f.bobOrg],
    ])('answers 404, not 409, for %s non-empty list', async (_label, orgId, listId) => {
      const response = await send(app, 'delete', `${base(orgId)}/lists/${listId(fixtures)}.json`, ALICE).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });
  });

  describe('validation', () => {
    const tooLong = 'é'.repeat(256);
    const maxLength = '😀'.repeat(255);
    let listId: number;
    let itemId: number;

    beforeAll(async () => {
      listId = (await createList(app, ALICE, null, 'Validation')).id;
      itemId = (await createItem(app, ALICE, null, listId)).id;
    });

    it.each([
      ['an empty name', { name: '' }],
      ['a whitespace-only name', { name: '   ' }],
      ['a 256-code-point name', { name: tooLong }],
      ['a control character', { name: 'a\u0000b' }],
      ['a missing name', {}],
      ['a user_id', { name: 'ok', user_id: 2 }],
      ['an organization_id', { name: 'ok', organization_id: 2 }],
      ['an id', { name: 'ok', id: 5 }],
    ])('answers 400 on list create and rename for %s', async (_label, body) => {
      expectValidationErrorBody(await send(app, 'post', `${base(null)}/lists.json`, ALICE, body));
      expectValidationErrorBody(await send(app, 'patch', `${base(null)}/lists/${listId}.json`, ALICE, body));
    });

    it('accepts a 255-code-point name', async () => {
      const response = await send(app, 'patch', `${base(null)}/lists/${listId}.json`, ALICE, { name: maxLength })
        .expect(200);

      expect(response.body.name).toBe(maxLength);
    });

    it.each([
      ['an empty description', { description: '' }],
      ['a whitespace-only description', { description: ' \t ' }],
      ['a 256-code-point description', { description: tooLong }],
      ['a control character', { description: 'a\nb' }],
      ['a null description', { description: null }],
      ['done: "true"', { description: 'ok', done: 'true' }],
      ['done: 1', { description: 'ok', done: 1 }],
      ['done: null', { description: 'ok', done: null }],
      ['a list_id', { description: 'ok', list_id: 2 }],
      ['a user_id', { description: 'ok', user_id: 2 }],
      ['an organization_id', { description: 'ok', organization_id: 2 }],
      ['an id', { description: 'ok', id: 5 }],
    ])('answers 400 on item create for %s', async (_label, body) => {
      expectValidationErrorBody(await send(app, 'post', `${base(null)}/lists/${listId}/items.json`, ALICE, body));
    });

    it.each([
      ['{}', {}],
      ['an empty description', { description: '' }],
      ['a 256-code-point description', { description: tooLong }],
      ['a null description', { description: null }],
      ['a null done', { done: null }],
      ['done: "true"', { done: 'true' }],
      ['done: 1', { done: 1 }],
      ['a list_id', { done: true, list_id: 2 }],
      ['an id', { done: true, id: 5 }],
    ])('answers 400 on item update for %s', async (_label, body) => {
      const path = `${base(null)}/lists/${listId}/items/${itemId}.json`;

      expectValidationErrorBody(await send(app, 'patch', path, ALICE, body));
    });

    it('accepts { done: false } alone on item update', async () => {
      const path = `${base(null)}/lists/${listId}/items/${itemId}.json`;
      await send(app, 'patch', path, ALICE, { done: true }).expect(200);

      const response = await send(app, 'patch', path, ALICE, { done: false }).expect(200);

      expect(response.body.done).toBe(false);
    });

    it('accepts a 255-code-point description with done on item create', async () => {
      const response = await send(app, 'post', `${base(null)}/lists/${listId}/items.json`, ALICE, {
        description: maxLength,
        done: true,
      }).expect(201);

      expect(response.body).toEqual(expect.objectContaining({ description: maxLength, done: true }));
    });
  });

  describe('cache headers', () => {
    it.each(CONTEXTS)('marks reads user-scoped in the %s context', async (_label, orgId) => {
      const response = await send(app, 'get', `${base(orgId)}/lists.json`, ALICE).expect(200);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it.each([
      ['personal', null, '/todo'],
      ['organization', ALICE_ORG, `/orgs/${ALICE_ORG}/todo`],
    ])('invalidates the owner\'s todo subtree on a write in the %s context', async (_label, orgId, expected) => {
      const created = await send(app, 'post', `${base(orgId)}/lists.json`, ALICE, { name: 'Cached' }).expect(201);
      expect(created.headers['x-cache-invalidate']).toBe(expected);

      const item = await send(app, 'post', `${base(orgId)}/lists/${created.body.id}/items.json`, ALICE, {
        description: 'x',
      }).expect(201);
      expect(item.headers['x-cache-invalidate']).toBe(expected);
    });

    it('emits no invalidation on a 404', async () => {
      const response = await send(app, 'patch', `${base(null)}/lists/999999.json`, ALICE, { name: 'X' }).expect(404);

      expect(response.headers['x-cache-invalidate']).toBeUndefined();
    });
  });

  describe('roles (security review)', () => {
    it('answers the uniform 403 to a user member on list rename', async () => {
      const response = await send(app, 'patch', `${base(ALICE_ORG)}/lists/${fixtures.aliceOrg}.json`, ORG_MEMBERS.user, {
        name: 'Renamed',
      }).expect(403);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_403);
    });

    it('answers the uniform 403 to a user member on item delete', async () => {
      const path = `${base(ALICE_ORG)}/lists/${fixtures.aliceOrg}/items/${fixtures.items.aliceOrg}.json`;
      const response = await send(app, 'delete', path, ORG_MEMBERS.user).expect(403);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_403);
    });

    it('lets Bob manage his own organization\'s lists', async () => {
      await send(app, 'get', `${base(BOB_ORG)}/lists/${fixtures.bobOrg}.json`, BOB).expect(200);
    });
  });
});
