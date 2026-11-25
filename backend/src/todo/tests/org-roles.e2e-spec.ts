import type { INestApplication } from '@nestjs/common';
import {
  ALICE,
  ALICE_ORG,
  base,
  BOB,
  buildTodoTestApp,
  createItem,
  createList,
  send,
  TODO_SETUP_TIMEOUT_MS,
  type TodoTestApp,
  withoutTimestamp,
} from './support/build-todo-test-app.js';
import { ORG_MEMBERS, seedOrgRoles, UNIFORM_403, UNIFORM_404 } from './support/owner-matrix.js';
import { hasMinRole, OrgRole } from '../../core/org-role.js';

// The per-role matrix (ported from the organizations spec's bank sample): every owner-scoped todo
// write route, under `/orgs/:orgId/todo/...`, against an `owner`, an `admin`, a `user` and a
// non-member. A role at or above the route's `@MinOrgRole` gets 2xx, a lower role the uniform 403,
// and a non-member the uniform 404. Fixtures are created by Alice (the organization's owner) before
// each request.

type Body = Record<string, unknown>;
type Method = 'post' | 'patch' | 'delete';

interface Prepared {
  path: string;
  body?: Body;
}

interface RouteCase {
  label: string;
  method: Method;
  minRole: OrgRole;
  setup: (orgId: number | null) => Promise<Prepared>;
}

const ROLES = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.USER];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('organization roles on todo writes (e2e)', () => {
  let app: INestApplication;
  let harness: TodoTestApp;

  const list = async (orgId: number | null): Promise<number> => (await createList(app, ALICE, orgId, uniqueName('List'))).id;
  const item = async (orgId: number | null): Promise<string> => {
    const listId = await list(orgId);

    return `${base(orgId)}/lists/${listId}/items/${(await createItem(app, ALICE, orgId, listId)).id}.json`;
  };

  const ROUTES: RouteCase[] = [
    { label: 'POST lists.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/lists.json`, body: { name: uniqueName('New') },
    }) },
    { label: 'PATCH lists/:id.json', method: 'patch', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/lists/${await list(orgId)}.json`, body: { name: uniqueName('Renamed') },
    }) },
    { label: 'DELETE lists/:id.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/lists/${await list(orgId)}.json`,
    }) },
    { label: 'POST lists/:id/items.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/lists/${await list(orgId)}/items.json`, body: { description: 'Eggs' },
    }) },
    { label: 'PATCH lists/:id/items/:itemId.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: await item(orgId), body: { done: true },
    }) },
    { label: 'DELETE lists/:id/items/:itemId.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: await item(orgId),
    }) },
  ];

  beforeAll(async () => {
    harness = await buildTodoTestApp();
    ({ app } = harness);
    seedOrgRoles(harness.seedMembership);
  }, TODO_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
  });

  it('covers every owner-scoped todo write route', () => {
    expect(ROUTES).toHaveLength(6);
  });

  describe.each(ROUTES)('$label (min $minRole)', ({ method, minRole, setup }) => {
    it.each(ROLES)('as %s', async (role) => {
      const { path, body } = await setup(ALICE_ORG);
      const response = await send(app, method, path, ORG_MEMBERS[role], body);

      if (hasMinRole(role, minRole)) {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      } else {
        expect(response.status).toBe(403);
        expect(withoutTimestamp(response)).toEqual(UNIFORM_403);
      }
    });

    it('as a non-member answers the uniform 404', async () => {
      const { path, body } = await setup(ALICE_ORG);
      const response = await send(app, method, path, BOB, body).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    if (minRole === OrgRole.ADMIN) {
      it('is unaffected in the personal context', async () => {
        const { path, body } = await setup(null);
        const response = await send(app, method, path, ALICE, body);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      });
    }
  });

  describe('the 403', () => {
    it('leaves the data untouched (a user cannot delete a list)', async () => {
      const id = await list(ALICE_ORG);

      await send(app, 'delete', `${base(ALICE_ORG)}/lists/${id}.json`, ORG_MEMBERS.user).expect(403);
      expect(harness.lists.rows.some((row) => row.id === id)).toBe(true);
      await send(app, 'get', `${base(ALICE_ORG)}/lists/${id}.json`, ORG_MEMBERS.user).expect(200);
    });

    it('leaves the data untouched (a user cannot delete an item)', async () => {
      const path = await item(ALICE_ORG);

      await send(app, 'delete', path, ORG_MEMBERS.user).expect(403);
      expect(harness.items.rows.some((row) => path.endsWith(`/items/${row.id}.json`))).toBe(true);
    });

    it('names neither the resource nor the required role', async () => {
      const id = await list(ALICE_ORG);
      const response = await send(app, 'patch', `${base(ALICE_ORG)}/lists/${id}.json`, ORG_MEMBERS.user, {
        name: 'X',
      }).expect(403);

      expect(JSON.stringify(response.body)).not.toMatch(/admin|list|todo/i);
    });
  });

  describe('the 404 comes before the role check', () => {
    it.each(['0' + String(ALICE_ORG), 'abc', '-1'])('for the malformed :orgId %p', async (orgId) => {
      const response = await send(app, 'post', `/orgs/${orgId}/todo/lists.json`, ORG_MEMBERS.user, { name: 'X' })
        .expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('for a non-member on an admin route', async () => {
      const response = await send(app, 'post', `${base(ALICE_ORG)}/lists.json`, BOB, { name: 'X' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });
  });

  describe('reads stay open to every member', () => {
    it.each(ROLES)('as %s', async (role) => {
      const id = await list(ALICE_ORG);

      await send(app, 'get', `${base(ALICE_ORG)}/lists.json`, ORG_MEMBERS[role]).expect(200);
      await send(app, 'get', `${base(ALICE_ORG)}/lists/${id}.json`, ORG_MEMBERS[role]).expect(200);
    });
  });
});
