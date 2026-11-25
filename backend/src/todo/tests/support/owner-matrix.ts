import type { INestApplication } from '@nestjs/common';
import { ADMIN, ALICE, ALICE_ORG, BOB, BOB_ORG, createItem, createList, type TodoTestApp } from './build-todo-test-app.js';
import { OrgRole } from '../../../core/org-role.js';

// Fixtures and cases for the owner-context 404 matrix (ported from the organizations spec's
// `code_sample/.../bank/tests/support/owner-matrix.ts`, accounts → lists, transactions → items).

/** The uniform owner-scoped 404 body, without its timestamp (compare with `withoutTimestamp`). */
export const UNIFORM_404 = { error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404 };

/** The uniform organization-role 403 body, without its timestamp (compare with `withoutTimestamp`). */
export const UNIFORM_403 = { error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode: 403 };

/** Extra members of `ALICE_ORG`, one per role (seeded with {@link seedOrgRoles}). */
export const ORG_MEMBERS: Record<OrgRole, string> = {
  [OrgRole.OWNER]: 'org_owner',
  [OrgRole.ADMIN]: 'org_admin',
  [OrgRole.USER]: 'org_user',
};

/**
 * Seeds {@link ORG_MEMBERS} on `ALICE_ORG`.
 * @param {TodoTestApp['seedMembership']} seedMembership - The harness seeding helper.
 * @returns {void}
 */
export function seedOrgRoles(seedMembership: TodoTestApp['seedMembership']): void {
  Object.entries(ORG_MEMBERS).forEach(([role, user]) => seedMembership(user, ALICE_ORG, role as OrgRole));
}

type OwnerKey = 'alicePersonal' | 'aliceOrg' | 'bobPersonal' | 'bobOrg';

export interface OwnerFixtures {
  alicePersonal: number;
  aliceOrg: number;
  bobPersonal: number;
  bobOrg: number;
  /** A second (empty) personal list of Alice's, for "an item under another list of the same owner". */
  alicePersonalOther: number;
  /** One item per owner's list. */
  items: Record<OwnerKey, number>;
}

export interface MatrixCase {
  label: string;
  user: string;
  admin: boolean;
  orgId: number | null;
  listId: (fixtures: OwnerFixtures) => number | string;
}

export interface ItemMatrixCase {
  label: string;
  orgId: number | null;
  listId: (fixtures: OwnerFixtures) => number | string;
  itemId: (fixtures: OwnerFixtures) => number | string;
}

/** Every way a list id must answer the uniform 404. */
export const NOT_FOUND_CASES: MatrixCase[] = [
  { label: 'an unknown id', user: ALICE, admin: false, orgId: null, listId: () => 999999 },
  { label: 'a non-numeric id', user: ALICE, admin: false, orgId: null, listId: () => 'abc' },
  { label: 'another user\'s personal list', user: ALICE, admin: false, orgId: null, listId: (f) => f.bobPersonal },
  { label: 'an organization list on a personal route', user: ALICE, admin: false, orgId: null, listId: (f) => f.aliceOrg },
  { label: 'a personal list on an organization route', user: ALICE, admin: false, orgId: ALICE_ORG, listId: (f) => f.alicePersonal },
  { label: 'another organization\'s list', user: ALICE, admin: false, orgId: ALICE_ORG, listId: (f) => f.bobOrg },
  { label: 'a non-member :orgId', user: ALICE, admin: false, orgId: BOB_ORG, listId: (f) => f.bobOrg },
  { label: 'a global admin on another user\'s personal list', user: ADMIN, admin: true, orgId: null, listId: (f) => f.alicePersonal },
  { label: 'a global admin who is not a member', user: ADMIN, admin: true, orgId: ALICE_ORG, listId: (f) => f.aliceOrg },
];

/** Every way an item id (under a list Alice can reach) must answer the uniform 404. */
export const ITEM_NOT_FOUND_CASES: ItemMatrixCase[] = [
  { label: 'an item under another list of the same owner', orgId: null, listId: (f) => f.alicePersonalOther, itemId: (f) => f.items.alicePersonal },
  { label: 'another user\'s item', orgId: null, listId: (f) => f.alicePersonal, itemId: (f) => f.items.bobPersonal },
  { label: 'another organization\'s item', orgId: ALICE_ORG, listId: (f) => f.aliceOrg, itemId: (f) => f.items.bobOrg },
  { label: 'an organization item on a personal route', orgId: null, listId: (f) => f.alicePersonal, itemId: (f) => f.items.aliceOrg },
  { label: 'a personal item on an organization route', orgId: ALICE_ORG, listId: (f) => f.aliceOrg, itemId: (f) => f.items.alicePersonal },
  { label: 'an unknown :itemId', orgId: null, listId: (f) => f.alicePersonal, itemId: () => 999999 },
  { label: 'a non-numeric :itemId', orgId: null, listId: (f) => f.alicePersonal, itemId: () => 'abc' },
  { label: 'a zero-padded :itemId', orgId: null, listId: (f) => f.alicePersonal, itemId: (f) => `0${f.items.alicePersonal}` },
  { label: 'an exponent :itemId', orgId: null, listId: (f) => f.alicePersonal, itemId: () => '1e3' },
];

/**
 * Creates one list (with one item) per owner: Alice and Bob, personal and organization, plus an
 * empty second personal list of Alice's.
 * @param {INestApplication} app - The app.
 * @returns {Promise<OwnerFixtures>} The ids.
 */
export async function createOwnerFixtures(app: INestApplication): Promise<OwnerFixtures> {
  const alicePersonal = (await createList(app, ALICE, null, 'Alice personal')).id;
  const aliceOrg = (await createList(app, ALICE, ALICE_ORG, 'Alice org')).id;
  const bobPersonal = (await createList(app, BOB, null, 'Bob personal')).id;
  const bobOrg = (await createList(app, BOB, BOB_ORG, 'Bob org')).id;
  const alicePersonalOther = (await createList(app, ALICE, null, 'Alice other')).id;

  return {
    alicePersonal,
    aliceOrg,
    bobPersonal,
    bobOrg,
    alicePersonalOther,
    items: {
      alicePersonal: (await createItem(app, ALICE, null, alicePersonal)).id,
      aliceOrg: (await createItem(app, ALICE, ALICE_ORG, aliceOrg)).id,
      bobPersonal: (await createItem(app, BOB, null, bobPersonal)).id,
      bobOrg: (await createItem(app, BOB, BOB_ORG, bobOrg)).id,
    },
  };
}

/**
 * @param {unknown} value - A response body.
 * @returns {string[]} Every owner-field key (including `list_id`/`listId`) found anywhere in it.
 */
export function ownerKeysIn(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(ownerKeysIn);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) => [
      ...(['user_id', 'organization_id', 'userId', 'organizationId', 'list_id', 'listId'].includes(key) ? [key] : []),
      ...ownerKeysIn(nested),
    ]);
  }

  return [];
}
