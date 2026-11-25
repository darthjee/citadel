import HashRouteResolver from '../../../../../assets/js/utils/routing/HashRouteResolver.js';
import { ROUTES_CONTEXT } from '../../../../../assets/js/utils/routing/routes.js';

const PERSONAL = { kind: 'personal' };

function resolve(hash, options) {
  return new HashRouteResolver(() => hash, options).resolve();
}

function organization(orgId) {
  return { kind: 'organization', orgId };
}

describe('HashRouteResolver', () => {
  describe('Personal-only routes', () => {
    [
      ['#/recover-password', 'reset-password'],
      ['#/recover-password?token=abc123', 'reset-password'],
      ['#/admin/users', 'admin-users'],
      ['#/admin/users/42/edit', 'admin-user-edit'],
      ['#/account/authorization-requests', 'authorization-requests'],
      ['#/account/my-account', 'my-account'],
      ['#/orgs/new', 'org-new'],
      ['#/', 'home'],
      ['', 'home'],
    ].forEach(([hash, page]) => {
      it(`resolves ${JSON.stringify(hash)} to ${page} in the Personal context`, () => {
        expect(resolve(hash)).toEqual({ page, context: PERSONAL });
      });
    });

    ['#/register', '#/login', '#/recover', '#/unknown'].forEach((hash) => {
      it(`falls back to home for ${hash}`, () => {
        expect(resolve(hash)).toEqual({ page: 'home', context: PERSONAL });
      });
    });

    it('does not match Personal-only routes under an organization prefix', () => {
      expect(resolve('#/orgs/5/admin/users')).toEqual({ page: 'home', context: PERSONAL });
      expect(resolve('#/orgs/5/orgs/new')).toEqual({ page: 'home', context: PERSONAL });
    });
  });

  describe('organization-only routes', () => {
    it('resolves the organization root to org-overview', () => {
      expect(resolve('#/orgs/5')).toEqual({ page: 'org-overview', context: organization(5) });
    });

    it('resolves the organization root with a trailing slash', () => {
      expect(resolve('#/orgs/5/')).toEqual({ page: 'org-overview', context: organization(5) });
    });

    it('resolves the organization edit page', () => {
      expect(resolve('#/orgs/5/edit')).toEqual({ page: 'org-edit', context: organization(5) });
    });

    it('strips the query string', () => {
      expect(resolve('#/orgs/5/edit?x=1')).toEqual({ page: 'org-edit', context: organization(5) });
    });

    it('accepts the max id boundary', () => {
      expect(resolve('#/orgs/2147483647')).toEqual({ page: 'org-overview', context: organization(2147483647) });
    });

    it('does not resolve organization-only routes as Personal', () => {
      expect(resolve('#/edit')).toEqual({ page: 'home', context: PERSONAL });
    });

    it('falls back to home for an unknown rest under a valid id', () => {
      expect(resolve('#/orgs/5/unknown')).toEqual({ page: 'home', context: PERSONAL });
    });
  });

  describe('malformed organization ids', () => {
    ['abc', '007', '-1', '1.5', '1e3', '99999999999', '0', '2147483648'].forEach((segment) => {
      it(`resolves /orgs/${segment} to not-found`, () => {
        expect(resolve(`#/orgs/${segment}`)).toEqual({ page: 'not-found', context: PERSONAL });
      });
    });

    it('resolves a malformed id with a rest to not-found', () => {
      expect(resolve('#/orgs/abc/edit')).toEqual({ page: 'not-found', context: PERSONAL });
    });
  });

  describe('context-aware routes', () => {
    const options = { contextRoutes: [['/x', 'x-page'], ['/x/:id', 'x-show']] };

    it('lists bank-account-new before bank-account', () => {
      const keys = ROUTES_CONTEXT.map(([, key]) => key);

      expect(keys.indexOf('bank-account-new')).toBeLessThan(keys.indexOf('bank-account'));
    });

    it('lists bank-debt-new before bank-debt', () => {
      const keys = ROUTES_CONTEXT.map(([, key]) => key);

      expect(keys.indexOf('bank-debt-new')).toBeLessThan(keys.indexOf('bank-debt'));
    });

    it('lists bank-investment-new before bank-investment', () => {
      const keys = ROUTES_CONTEXT.map(([, key]) => key);

      expect(keys.indexOf('bank-investment-new')).toBeLessThan(keys.indexOf('bank-investment'));
    });

    it('lists bank-provider-new and bank-provider-accountant before bank-provider', () => {
      const keys = ROUTES_CONTEXT.map(([, key]) => key);

      expect(keys.indexOf('bank-provider-new')).toBeLessThan(keys.indexOf('bank-provider'));
      expect(keys.indexOf('bank-provider-accountant')).toBeLessThan(keys.indexOf('bank-provider'));
    });

    it('matches a context route as Personal', () => {
      expect(resolve('#/x', options)).toEqual({ page: 'x-page', context: PERSONAL });
    });

    it('matches a context route under an organization', () => {
      expect(resolve('#/orgs/5/x', options)).toEqual({ page: 'x-page', context: organization(5) });
    });

    it('matches a parameterized context route under an organization', () => {
      expect(resolve('#/orgs/5/x/9?y=1', options)).toEqual({ page: 'x-show', context: organization(5) });
    });

    it('does not use the test-only routes by default', () => {
      expect(resolve('#/orgs/5/x')).toEqual({ page: 'home', context: PERSONAL });
    });
  });

  describe('bank routes', () => {
    [
      ['/bank/accounts', 'bank-accounts'],
      ['/bank/accounts?archived=true', 'bank-accounts'],
      ['/bank/accounts/new', 'bank-account-new'],
      ['/bank/accounts/12', 'bank-account'],
      ['/bank/accounts/12?page=3', 'bank-account'],
      ['/bank/accounts/12/edit', 'bank-account-edit'],
      ['/bank/debts', 'bank-debts'],
      ['/bank/debts?archived=true', 'bank-debts'],
      ['/bank/debts/new', 'bank-debt-new'],
      ['/bank/debts/7', 'bank-debt'],
      ['/bank/debts/7?page=2', 'bank-debt'],
      ['/bank/debts/7/edit', 'bank-debt-edit'],
      ['/bank/investments', 'bank-investments'],
      ['/bank/investments?archived=true', 'bank-investments'],
      ['/bank/investments/new', 'bank-investment-new'],
      ['/bank/investments/3', 'bank-investment'],
      ['/bank/investments/3?page=2', 'bank-investment'],
      ['/bank/investments/3/edit', 'bank-investment-edit'],
      ['/bank/providers', 'bank-providers'],
      ['/bank/providers?archived=true', 'bank-providers'],
      ['/bank/providers/new', 'bank-provider-new'],
      ['/bank/providers/accountant', 'bank-provider-accountant'],
      ['/bank/providers/4', 'bank-provider'],
      ['/bank/providers/4?page=2', 'bank-provider'],
      ['/bank/providers/4/edit', 'bank-provider-edit'],
      ['/bank/bills/new', 'bank-bill-new'],
      ['/bank/bills/new?provider=4', 'bank-bill-new'],
      ['/bank/bills/9/edit', 'bank-bill-edit'],
      ['/bank/bills/9/history', 'bank-bill-history'],
      ['/bank/calendar', 'bank-calendar'],
      ['/bank/calendar/month', 'bank-calendar-month'],
      ['/bank/calendar/month?m=2026-12', 'bank-calendar-month'],
    ].forEach(([path, page]) => {
      it(`resolves #${path} to ${page} in the Personal context`, () => {
        expect(resolve(`#${path}`)).toEqual({ page, context: PERSONAL });
      });

      it(`resolves #/orgs/5${path} to ${page} in the organization context`, () => {
        expect(resolve(`#/orgs/5${path}`)).toEqual({ page, context: organization(5) });
      });
    });
  });

  it('exposes the current hash', () => {
    const resolver = new HashRouteResolver(() => '#/register');

    expect(resolver.currentHash()).toBe('#/register');
  });

  it('defaults to reading window.location.hash', () => {
    const resolver = new HashRouteResolver();

    expect(resolver.currentHash()).toBe('');
  });
});
