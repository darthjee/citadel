import type { INestApplication } from '@nestjs/common';
import { ADMIN, ALICE, ALICE_ORG, base, type BankTestApp, BOB, BOB_ORG, createAccount, send } from './build-bank-test-app.js';
import { OrgRole } from '../../../core/org-role.js';

// Fixtures and cases for the owner-context 404 matrix (regular.md / transactions.md *Required
// tests*, and the record-level tests of auth/organizations.md moved from #46).

/** The uniform owner-scoped 404 body, without its timestamp (compare with `withoutTimestamp`). */
export const UNIFORM_404 = { error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404 };

/** The uniform organization-role 403 body, without its timestamp (compare with `withoutTimestamp`). */
export const UNIFORM_403 = { error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode: 403 };

/** Extra members of `ALICE_ORG`, one per role (seeded with {@link seedOrgRoles}). */
export const ORG_MEMBERS: Record<OrgRole, string> = {
  [OrgRole.OWNER]: '20',
  [OrgRole.ADMIN]: '21',
  [OrgRole.USER]: '22',
};

/**
 * Seeds {@link ORG_MEMBERS} on `ALICE_ORG` (joining arrives in #82).
 * @param {BankTestApp['seedMembership']} seedMembership - The harness seeding helper.
 * @returns {void}
 */
export function seedOrgRoles(seedMembership: BankTestApp['seedMembership']): void {
  Object.entries(ORG_MEMBERS).forEach(([role, user]) => seedMembership(user, ALICE_ORG, role as OrgRole));
}

export interface OwnerFixtures {
  alicePersonal: number;
  aliceOrg: number;
  bobPersonal: number;
  bobOrg: number;
  transactions: Record<'alicePersonal' | 'aliceOrg' | 'bobPersonal' | 'bobOrg', number>;
}

export interface MatrixCase {
  label: string;
  user: string;
  admin: boolean;
  orgId: number | null;
  accountId: (fixtures: OwnerFixtures) => number | string;
}

/** Every way an account id must answer the uniform 404. */
export const NOT_FOUND_CASES: MatrixCase[] = [
  { label: 'an unknown id', user: ALICE, admin: false, orgId: null, accountId: () => 999999 },
  { label: 'a non-numeric id', user: ALICE, admin: false, orgId: null, accountId: () => 'abc' },
  { label: 'another user\'s personal account', user: ALICE, admin: false, orgId: null, accountId: (f) => f.bobPersonal },
  { label: 'an organization account on a personal route', user: ALICE, admin: false, orgId: null, accountId: (f) => f.aliceOrg },
  { label: 'a personal account on an organization route', user: ALICE, admin: false, orgId: ALICE_ORG, accountId: (f) => f.alicePersonal },
  { label: 'another organization\'s account', user: ALICE, admin: false, orgId: ALICE_ORG, accountId: (f) => f.bobOrg },
  { label: 'a non-member :orgId', user: ALICE, admin: false, orgId: BOB_ORG, accountId: (f) => f.bobOrg },
  { label: 'a global admin on another user\'s personal account', user: ADMIN, admin: true, orgId: null, accountId: (f) => f.alicePersonal },
  { label: 'a global admin who is not a member', user: ADMIN, admin: true, orgId: ALICE_ORG, accountId: (f) => f.aliceOrg },
];

async function addTransaction(app: INestApplication, user: string, orgId: number | null, accountId: number): Promise<number> {
  const response = await send(app, 'post', `${base(orgId)}/accounts/${accountId}/transactions.json`, user, {
    date: '2026-01-02',
    amount: '-1.00',
    description: 'fixture',
  }).expect(201);

  return response.body.id;
}

/**
 * Creates one account (with one transaction) per owner: Alice and Bob, personal and organization.
 * @param {INestApplication} app - The app.
 * @returns {Promise<OwnerFixtures>} The ids.
 */
export async function createOwnerFixtures(app: INestApplication): Promise<OwnerFixtures> {
  const opening = { opening_date: '2026-01-01' };
  const alicePersonal = (await createAccount(app, ALICE, null, opening)).id;
  const aliceOrg = (await createAccount(app, ALICE, ALICE_ORG, opening)).id;
  const bobPersonal = (await createAccount(app, BOB, null, opening)).id;
  const bobOrg = (await createAccount(app, BOB, BOB_ORG, opening)).id;

  return {
    alicePersonal,
    aliceOrg,
    bobPersonal,
    bobOrg,
    transactions: {
      alicePersonal: await addTransaction(app, ALICE, null, alicePersonal),
      aliceOrg: await addTransaction(app, ALICE, ALICE_ORG, aliceOrg),
      bobPersonal: await addTransaction(app, BOB, null, bobPersonal),
      bobOrg: await addTransaction(app, BOB, BOB_ORG, bobOrg),
    },
  };
}

/**
 * @param {unknown} value - A response body.
 * @returns {string[]} Every owner-field key found anywhere in it.
 */
export function ownerKeysIn(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(ownerKeysIn);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) => [
      ...(['user_id', 'organization_id', 'userId', 'organizationId'].includes(key) ? [key] : []),
      ...ownerKeysIn(nested),
    ]);
  }

  return [];
}
