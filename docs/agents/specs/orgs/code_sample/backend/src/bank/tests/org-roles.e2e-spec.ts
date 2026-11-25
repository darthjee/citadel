import type { INestApplication } from '@nestjs/common';
import {
  ALICE,
  ALICE_ORG,
  base,
  BOB,
  buildBankTestApp,
  createAccount,
  send,
  withoutTimestamp,
} from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { ORG_MEMBERS, seedOrgRoles, UNIFORM_403, UNIFORM_404 } from './support/owner-matrix.js';
import { hasMinRole, OrgRole } from '../../core/org-role.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../payment-generated.query.js', () => jest.requireActual('./support/in-memory-payment-generated.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));
jest.mock('../accountant-charges.query.js', () => jest.requireActual('./support/in-memory-accountant-charges.query.js'));

// The per-role matrix of #143: every owner-scoped bank write route, under `/orgs/:orgId/bank/...`,
// against an `owner`, an `admin`, a `user` and a non-member. A role at or above the route's
// `@MinOrgRole` gets 2xx, a lower role the uniform 403, and a non-member the uniform 404. Fixtures
// are created by Alice (the organization's original owner) before each request.

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

describe('organization roles on bank writes (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const expectOk = async (method: Method, path: string, body?: Body, user = ALICE): Promise<Body> => {
    const response = await send(app, method, path, user, body);

    if (response.status >= 300) {
      throw new Error(`setup ${method.toUpperCase()} ${path} answered ${response.status}: ${JSON.stringify(response.body)}`);
    }

    return response.body as Body;
  };
  const regular = async (orgId: number | null): Promise<number> =>
    (await createAccount(app, ALICE, orgId, { name: uniqueName('Checking'), opening_date: '2026-01-01' })).id;
  const debt = async (orgId: number | null): Promise<number> =>
    (await createAccount(app, ALICE, orgId, {
      type: 'debt',
      name: uniqueName('Loan'),
      debt: { due_day: 10, instalment_amount: '500.00', bills_from: '2026-01-01' },
    })).id;
  const provider = async (orgId: number | null): Promise<number> =>
    (await createAccount(app, ALICE, orgId, { type: 'provider_expense', name: uniqueName('Vivo'), opening_date: '2026-01-01' })).id;
  const providerBill = async (orgId: number | null): Promise<number> => {
    const providerId = await provider(orgId);
    const created = await expectOk('post', `${base(orgId)}/accounts/${providerId}/provider-bills.json`, {
      kind: 'recurring', description: uniqueName('Plan'), due_day: 5, expected_amount: '200.00', bills_from: '2026-01-01',
    });

    return created.id as number;
  };
  const bill = async (orgId: number | null): Promise<number> => {
    const created = await expectOk('post', `${base(orgId)}/bills.json`, {
      provider_account_id: await provider(orgId),
      paying_account_id: await regular(orgId),
      due_date: '2026-01-20',
      amount: '80.00',
      description: uniqueName('IPVA'),
    });

    return created.id as number;
  };
  const transaction = async (orgId: number | null, accountId: number): Promise<number> => {
    const created = await expectOk('post', `${base(orgId)}/accounts/${accountId}/transactions.json`, {
      date: '2026-01-02', amount: '-10.00', description: 'Charge',
    });

    return created.id as number;
  };
  const statementBody = { statement_date: '2026-02-28', statement_balance: '0' };
  // An account with an open statement (the regular account opens at 0, so a 0 statement balances).
  const statement = async (orgId: number | null): Promise<{ accountId: number; path: string }> => {
    const accountId = await regular(orgId);
    const created = await expectOk('post', `${base(orgId)}/accounts/${accountId}/reconciliations.json`, statementBody);

    return { accountId, path: `${base(orgId)}/accounts/${accountId}/reconciliations/${created.id as number}` };
  };
  const skip = { status: 'skipped' };
  const occurrencePath = (orgId: number | null, accountId: number) =>
    `${base(orgId)}/accounts/${accountId}/occurrences/2026-01-10/payment.json`;
  const perBillPath = (orgId: number | null, id: number) => `${base(orgId)}/provider-bills/${id}/occurrences/2026-01-05/payment.json`;

  const ROUTES: RouteCase[] = [
    { label: 'POST accounts.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts.json`, body: { name: uniqueName('New') },
    }) },
    { label: 'PATCH accounts/:accountId.json', method: 'patch', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}.json`, body: { name: uniqueName('Renamed') },
    }) },
    { label: 'DELETE accounts/:accountId.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}.json`,
    }) },
    { label: 'POST accounts/:accountId/archive.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}/archive.json`,
    }) },
    { label: 'POST accounts/:accountId/unarchive.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const id = await regular(orgId);
      await expectOk('post', `${base(orgId)}/accounts/${id}/archive.json`);

      return { path: `${base(orgId)}/accounts/${id}/unarchive.json` };
    } },
    { label: 'POST accounts/:accountId/transactions.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}/transactions.json`,
      body: { date: '2026-01-03', amount: '-5.00', description: 'Coffee' },
    }) },
    { label: 'PATCH accounts/:accountId/transactions/:transactionId.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => {
      const accountId = await regular(orgId);

      return {
        path: `${base(orgId)}/accounts/${accountId}/transactions/${await transaction(orgId, accountId)}.json`,
        body: { description: 'Edited' },
      };
    } },
    { label: 'DELETE accounts/:accountId/transactions/:transactionId.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const accountId = await regular(orgId);

      return { path: `${base(orgId)}/accounts/${accountId}/transactions/${await transaction(orgId, accountId)}.json` };
    } },
    { label: 'POST bills.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/bills.json`,
      body: {
        provider_account_id: await provider(orgId),
        paying_account_id: await regular(orgId),
        due_date: '2026-02-20',
        amount: '10.00',
        description: uniqueName('Fee'),
      },
    }) },
    { label: 'PATCH bills/:id.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/bills/${await bill(orgId)}.json`, body: { description: uniqueName('Edited') },
    }) },
    { label: 'DELETE bills/:id.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/bills/${await bill(orgId)}.json`,
    }) },
    { label: 'POST accounts/:accountId/provider-bills.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await provider(orgId)}/provider-bills.json`,
      body: { kind: 'recurring', description: uniqueName('Plan'), due_day: 5, bills_from: '2026-01-01' },
    }) },
    { label: 'PATCH provider-bills/:id.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/provider-bills/${await providerBill(orgId)}.json`, body: { description: uniqueName('Edited') },
    }) },
    { label: 'DELETE provider-bills/:id.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/provider-bills/${await providerBill(orgId)}.json`,
    }) },
    { label: 'POST accounts/:accountId/occurrences/:dueDate/payment.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: occurrencePath(orgId, await debt(orgId)), body: skip,
    }) },
    { label: 'DELETE accounts/:accountId/occurrences/:dueDate/payment.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const path = occurrencePath(orgId, await debt(orgId));
      await expectOk('post', path, skip);

      return { path };
    } },
    { label: 'POST bills/:id/payment.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/bills/${await bill(orgId)}/payment.json`, body: skip,
    }) },
    { label: 'DELETE bills/:id/payment.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const path = `${base(orgId)}/bills/${await bill(orgId)}/payment.json`;
      await expectOk('post', path, skip);

      return { path };
    } },
    { label: 'POST provider-bills/:id/occurrences/:dueDate/payment.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: perBillPath(orgId, await providerBill(orgId)), body: skip,
    }) },
    { label: 'DELETE provider-bills/:id/occurrences/:dueDate/payment.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const path = perBillPath(orgId, await providerBill(orgId));
      await expectOk('post', path, skip);

      return { path };
    } },
    { label: 'POST accountant/mark-sent.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/accountant/mark-sent.json`,
      body: { transaction_ids: [await transaction(orgId, await provider(orgId))] },
    }) },
    { label: 'POST accountant/mark-unsent.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => {
      const ids = [await transaction(orgId, await provider(orgId))];
      await expectOk('post', `${base(orgId)}/accountant/mark-sent.json`, { transaction_ids: ids });

      return { path: `${base(orgId)}/accountant/mark-unsent.json`, body: { transaction_ids: ids } };
    } },
    { label: 'POST accounts/:accountId/reconciliations.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}/reconciliations.json`, body: statementBody,
    }) },
    { label: 'PATCH accounts/:accountId/reconciliations/:id.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${(await statement(orgId)).path}.json`, body: { statement_balance: '0' },
    }) },
    { label: 'DELETE accounts/:accountId/reconciliations/:id.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${(await statement(orgId)).path}.json`,
    }) },
    { label: 'PATCH accounts/:accountId/reconciliations/:id/ticks.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => {
      const { accountId, path } = await statement(orgId);

      return { path: `${path}/ticks.json`, body: { tick: [await transaction(orgId, accountId)] } };
    } },
    { label: 'POST accounts/:accountId/reconciliations/:id/finish.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${(await statement(orgId)).path}/finish.json`, body: {},
    }) },
    { label: 'POST accounts/:accountId/reconciliations/:id/undo.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const { path } = await statement(orgId);
      await expectOk('post', `${path}/finish.json`, {});

      return { path: `${path}/undo.json`, body: {} };
    } },
  ];

  beforeAll(async () => {
    let seedMembership: Parameters<typeof seedOrgRoles>[0];
    ({ app, repos, seedMembership } = await buildBankTestApp());
    seedOrgRoles(seedMembership);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('covers every owner-scoped bank write route', () => {
    expect(ROUTES).toHaveLength(28);
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
    it('leaves the data untouched (a user cannot delete an account)', async () => {
      const id = await regular(ALICE_ORG);

      await send(app, 'delete', `${base(ALICE_ORG)}/accounts/${id}.json`, ORG_MEMBERS.user).expect(403);
      expect(repos.accounts.rows.some((row) => row.id === id)).toBe(true);
      await send(app, 'get', `${base(ALICE_ORG)}/accounts/${id}.json`, ORG_MEMBERS.user).expect(200);
    });

    it('names neither the resource nor the required role', async () => {
      const id = await regular(ALICE_ORG);
      const response = await send(app, 'post', `${base(ALICE_ORG)}/accounts/${id}/archive.json`, ORG_MEMBERS.user).expect(403);

      expect(JSON.stringify(response.body)).not.toMatch(/admin|account|archive/i);
    });
  });

  describe('a payment-generated transaction', () => {
    const paidTransaction = async (): Promise<{ accountId: number; transactionId: number }> => {
      const checking = await regular(ALICE_ORG);
      await expectOk('post', occurrencePath(ALICE_ORG, await debt(ALICE_ORG)), {
        status: 'paid', paid_on: '2026-01-12', amount: '490.00', paying_account_id: checking,
      });
      const payment = repos.billPayments.rows[repos.billPayments.rows.length - 1];

      return { accountId: checking, transactionId: payment.withdrawalTransactionId as number };
    };
    const edit = async (role: OrgRole) => {
      const { accountId, transactionId } = await paidTransaction();

      return send(app, 'patch', `${base(ALICE_ORG)}/accounts/${accountId}/transactions/${transactionId}.json`, ORG_MEMBERS[role], {
        description: 'Edited',
      });
    };

    it('flags the transaction as payment_generated in the ledger, and no other row', async () => {
      const { accountId, transactionId } = await paidTransaction();
      await expectOk('post', `${base(ALICE_ORG)}/accounts/${accountId}/transactions.json`, {
        date: '2026-01-13', amount: '-10.00', description: 'Plain',
      });

      const response = await send(app, 'get', `${base(ALICE_ORG)}/accounts/${accountId}/transactions.json`, ORG_MEMBERS.user).expect(200);
      const flags = Object.fromEntries((response.body.transactions as Body[]).map((row) => [row.id, row.payment_generated]));

      expect(flags[transactionId]).toBe(true);
      expect(Object.values(flags).filter((flag) => flag === true)).toHaveLength(1);
      expect(Object.values(flags)).toHaveLength(2);
    });

    it('answers the uniform 403 to a user', async () => {
      const response = await edit(OrgRole.USER);

      expect(response.status).toBe(403);
      expect(withoutTimestamp(response)).toEqual(UNIFORM_403);
    });

    it.each([OrgRole.ADMIN, OrgRole.OWNER])('may be edited by an %s, answering payment_generated: true', async (role) => {
      const response = await edit(role);

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Edited');
      expect(response.body.payment_generated).toBe(true);
    });

    it('ignores a bill payment of another owner context referencing the same id', async () => {
      const accountId = await regular(ALICE_ORG);
      const created = await expectOk('post', `${base(ALICE_ORG)}/accounts/${accountId}/transactions.json`, {
        date: '2026-01-12', amount: '-10.00', description: 'Plain',
      });
      const foreignSource = await regular(null);
      await repos.billPayments.save(repos.billPayments.create({
        sourceAccountId: foreignSource, dueDate: '2026-01-10', status: 'paid', paymentTransactionId: created.id as number,
      }));

      const response = await send(app, 'patch', `${base(ALICE_ORG)}/accounts/${accountId}/transactions/${String(created.id)}.json`, ORG_MEMBERS.user, {
        description: 'Edited',
      });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Edited');
      expect(response.body.payment_generated).toBe(false);
    });
  });

  describe('the 404 comes before the role check', () => {
    it.each(['0' + String(ALICE_ORG), 'abc', '-1'])('for the malformed :orgId %p', async (orgId) => {
      const response = await send(app, 'post', `/orgs/${orgId}/bank/accounts.json`, ORG_MEMBERS.user, { name: 'X' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('for a non-member on an admin route', async () => {
      const response = await send(app, 'post', `${base(ALICE_ORG)}/accounts.json`, BOB, { name: 'X' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });
  });

  describe('reads stay open to every member', () => {
    it.each(ROLES)('as %s', async (role) => {
      await send(app, 'get', `${base(ALICE_ORG)}/accounts.json`, ORG_MEMBERS[role]).expect(200);
    });
  });
});
