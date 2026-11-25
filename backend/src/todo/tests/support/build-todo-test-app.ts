import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createOrganization,
  registerAndLogin,
  withoutTimestamp,
} from '../../../auth/tests/organization.controller.e2e-test-support.js';
import { loginCookie } from '../../../auth/tests/support/auth-requests.js';
import { buildAuthTestApp, type BuildAuthTestAppResult } from '../../../auth/tests/support/build-auth-test-app.js';
import { createInMemoryRepo, matchesCondition } from '../../../auth/tests/support/in-memory-repo.js';
import type { OrgRole } from '../../../core/org-role.js';
import { TodoItem } from '../../entities/todo-item.entity.js';
import { TodoList } from '../../entities/todo-list.entity.js';
import { TodoModule } from '../../todo.module.js';

export { withoutTimestamp };

// Users (by username) logged in once per app. ALICE is the harness's default `darthjee` user.
export const ALICE = 'darthjee';
export const BOB = 'bob';
// A global admin (`User.isAdmin`) who is a member of no organization: no bypass is expected.
export const ADMIN = 'vader';

// Organizations created while building the app, in this order (in-memory ids start at 1).
export const ALICE_ORG = 1;
export const BOB_ORG = 2;

// Extra users registered (but not made members) by the harness; `owner-matrix.ts` seeds their roles.
export const EXTRA_USERS = ['org_owner', 'org_admin', 'org_user'];

// One-time setup registers and logs in six users (bcrypt-heavy).
export const TODO_SETUP_TIMEOUT_MS = 90_000;

type Method = 'get' | 'post' | 'patch' | 'delete';

type InMemoryRepo<T extends { id?: number }> = ReturnType<typeof createInMemoryRepo<T>>;

export type InMemoryTodoRepo<T extends { id?: number }> = InMemoryRepo<T> & {
  delete: (criteria: Partial<T>) => Promise<{ affected: number }>;
};

export interface TodoTestApp {
  app: INestApplication;
  auth: BuildAuthTestAppResult;
  lists: InMemoryTodoRepo<TodoList>;
  items: InMemoryTodoRepo<TodoItem>;
  seedMembership: (username: string, orgId: number, role: OrgRole) => void;
}

const cookies = new WeakMap<INestApplication, Map<string, string>>();

// Adds what `TodoService` needs on top of `createInMemoryRepo()`: `save` stamps both timestamps
// (like `@CreateDateColumn`/`@UpdateDateColumn`), and `delete(criteria)` removes the matching rows.
function createInMemoryTodoRepo<T extends { id?: number; createdAt?: Date; updatedAt?: Date }>(): InMemoryTodoRepo<T> {
  const repo = createInMemoryRepo<T>();
  const save = async (entity: T): Promise<T> => {
    const now = new Date();
    entity.createdAt ??= now;
    entity.updatedAt = now;
    return repo.save(entity);
  };
  const remove = async (criteria: Partial<T>): Promise<{ affected: number }> => {
    const before = repo.rows.length;
    const kept = repo.rows.filter(
      (row) => !Object.entries(criteria).every(([key, value]) => matchesCondition((row as never)[key], value)),
    );

    repo.rows.splice(0, repo.rows.length, ...kept);

    return { affected: before - kept.length };
  };

  return { ...repo, save, delete: remove };
}

/**
 * Builds the todo e2e app: the auth harness (with `OwnerContextGuard` and the real
 * `OrganizationService` over in-memory repos) plus `TodoModule` over in-memory list/item repos.
 * Logs in ALICE, BOB, ADMIN (made a global admin) and {@link EXTRA_USERS}, and creates ALICE_ORG
 * (Alice's) and BOB_ORG (Bob's).
 */
export async function buildTodoTestApp(): Promise<TodoTestApp> {
  const lists = createInMemoryTodoRepo<TodoList>();
  const items = createInMemoryTodoRepo<TodoItem>();
  const auth = await buildAuthTestApp({
    adminGuard: true,
    ownerContextGuard: true,
    imports: [TodoModule],
    repoOverrides: [
      [TodoList, lists],
      [TodoItem, items],
    ],
  });
  const { app } = auth;
  const jar = new Map<string, string>([[ALICE, await loginCookie(app)]]);

  for (const username of [BOB, ADMIN, ...EXTRA_USERS]) {
    jar.set(username, await registerAndLogin(app, username));
  }

  cookies.set(app, jar);
  auth.userRepo.rows.find((user) => user.username === ADMIN)!.isAdmin = true;
  await createOrganization(app, jar.get(ALICE)!, { name: 'Alice Org' }).expect(201);
  await createOrganization(app, jar.get(BOB)!, { name: 'Bob Org' }).expect(201);

  const seedMembership = (username: string, orgId: number, role: OrgRole): void => {
    const user = auth.userRepo.rows.find((row) => row.username === username)!;

    auth.membershipRepo.rows.push(
      auth.membershipRepo.create({ id: auth.membershipRepo.rows.length + 100, organizationId: orgId, userId: user.id, role }),
    );
  };

  return { app, auth, lists, items, seedMembership };
}

/**
 * The todo route prefix for an owner context.
 * @param {number | null} orgId - The organization id, or `null` for the personal context.
 * @returns {string} `/todo` or `/orgs/<orgId>/todo`.
 */
export function base(orgId: number | string | null): string {
  return orgId === null ? '/todo' : `/orgs/${orgId}/todo`;
}

/**
 * Sends a request as a logged-in harness user.
 * @returns {request.Test} The un-awaited supertest request.
 */
export function send(app: INestApplication, method: Method, path: string, user: string, body?: object): request.Test {
  const cookie = cookies.get(app)?.get(user);

  if (!cookie) {
    throw new Error(`No logged-in harness user ${user}`);
  }

  const test = request(app.getHttpServer())[method](path).set('Cookie', [cookie]);

  return body === undefined ? test : test.send(body);
}

/**
 * Creates a list as `user` in a context, expecting 201.
 * @returns {Promise<Record<string, unknown> & { id: number }>} The created list's body.
 */
export async function createList(
  app: INestApplication,
  user: string,
  orgId: number | null,
  name = 'Groceries',
): Promise<Record<string, unknown> & { id: number }> {
  const response = await send(app, 'post', `${base(orgId)}/lists.json`, user, { name }).expect(201);

  return response.body;
}

/**
 * Adds an item to a list as `user` in a context, expecting 201.
 * @returns {Promise<Record<string, unknown> & { id: number }>} The created item's body.
 */
export async function createItem(
  app: INestApplication,
  user: string,
  orgId: number | null,
  listId: number,
  description = 'Milk',
): Promise<Record<string, unknown> & { id: number }> {
  const response = await send(app, 'post', `${base(orgId)}/lists/${listId}/items.json`, user, { description })
    .expect(201);

  return response.body;
}
