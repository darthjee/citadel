import HashRouteResolver from '../../../../../assets/js/utils/routing/HashRouteResolver.js';
import {
  ROUTES_CONTEXT,
  ROUTES_ORG_ONLY,
} from '../../../../../assets/js/utils/routing/routes.js';

const PERSONAL = { kind: 'personal' };

const FIXTURES = {
  orgOnlyRoutes: [['/', 'org-overview'], ['/edit', 'org-edit']],
  contextRoutes: [['/x', 'x-page'], ['/x/new', 'x-new'], ['/x/:id', 'x-show']],
};

function resolve(hash, options) {
  return new HashRouteResolver(() => hash, options).resolve();
}

function organization(orgId) {
  return { kind: 'organization', orgId };
}

describe('HashRouteResolver', () => {
  describe('Personal-only routes', () => {
    [
      ['#/orgs/new', 'org-new'],
      ['#/recover-password', 'reset-password'],
      ['#/recover-password?token=abc123', 'reset-password'],
      ['#/admin/users', 'admin-users'],
      ['#/admin/users/42/edit', 'admin-user-edit'],
      ['#/account/authorization-requests', 'authorization-requests'],
      ['#/account/my-account', 'my-account'],
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
      expect(resolve('#/orgs/5/admin/users', FIXTURES)).toEqual({ page: 'home', context: PERSONAL });
    });
  });

  describe('default tables', () => {
    it('registers the organization pages as organization-only routes', () => {
      expect(ROUTES_ORG_ONLY).toEqual([['/', 'org-overview'], ['/edit', 'org-edit']]);
    });

    it('starts with no context-aware routes', () => {
      expect(ROUTES_CONTEXT).toEqual([]);
    });

    it('resolves #/orgs/new to org-new in Personal without reading an org id', () => {
      expect(resolve('#/orgs/new')).toEqual({ page: 'org-new', context: PERSONAL });
    });

    it('resolves the organization root to org-overview', () => {
      expect(resolve('#/orgs/5')).toEqual({ page: 'org-overview', context: organization(5) });
    });

    it('resolves the organization edit page to org-edit', () => {
      expect(resolve('#/orgs/5/edit')).toEqual({ page: 'org-edit', context: organization(5) });
    });

    it('resolves a malformed id with a rest to not-found', () => {
      expect(resolve('#/orgs/abc/edit')).toEqual({ page: 'not-found', context: PERSONAL });
    });

    it('does not resolve /orgs/new under an organization prefix', () => {
      expect(resolve('#/orgs/5/orgs/new')).toEqual({ page: 'home', context: PERSONAL });
    });
  });

  describe('organization-only routes', () => {
    it('resolves the organization root', () => {
      expect(resolve('#/orgs/5', FIXTURES)).toEqual({ page: 'org-overview', context: organization(5) });
    });

    it('resolves the organization root with a trailing slash', () => {
      expect(resolve('#/orgs/5/', FIXTURES)).toEqual({ page: 'org-overview', context: organization(5) });
    });

    it('resolves an organization-only page', () => {
      expect(resolve('#/orgs/5/edit', FIXTURES)).toEqual({ page: 'org-edit', context: organization(5) });
    });

    it('strips the query string', () => {
      expect(resolve('#/orgs/5/edit?x=1', FIXTURES)).toEqual({ page: 'org-edit', context: organization(5) });
    });

    it('accepts the max id boundary', () => {
      expect(resolve('#/orgs/2147483647', FIXTURES))
        .toEqual({ page: 'org-overview', context: organization(2147483647) });
    });

    it('does not resolve organization-only routes as Personal', () => {
      expect(resolve('#/edit', FIXTURES)).toEqual({ page: 'home', context: PERSONAL });
    });

    it('falls back to home for an unknown rest under a valid id', () => {
      expect(resolve('#/orgs/5/unknown', FIXTURES)).toEqual({ page: 'home', context: PERSONAL });
    });
  });

  describe('malformed organization ids', () => {
    ['abc', '007', '-1', '1.5', '1e3', '99999999999', '0', '2147483648'].forEach((segment) => {
      it(`resolves /orgs/${segment} to not-found`, () => {
        expect(resolve(`#/orgs/${segment}`, FIXTURES)).toEqual({ page: 'not-found', context: PERSONAL });
      });
    });

    it('resolves a malformed id with a rest to not-found', () => {
      expect(resolve('#/orgs/abc/edit', FIXTURES)).toEqual({ page: 'not-found', context: PERSONAL });
    });

    it('resolves a malformed id to not-found with the default tables', () => {
      expect(resolve('#/orgs/007')).toEqual({ page: 'not-found', context: PERSONAL });
    });
  });

  describe('context-aware routes', () => {
    it('matches a context route as Personal', () => {
      expect(resolve('#/x', FIXTURES)).toEqual({ page: 'x-page', context: PERSONAL });
    });

    it('matches a context route under an organization', () => {
      expect(resolve('#/orgs/5/x', FIXTURES)).toEqual({ page: 'x-page', context: organization(5) });
    });

    it('matches a static context route before its parameterized sibling', () => {
      expect(resolve('#/orgs/5/x/new', FIXTURES)).toEqual({ page: 'x-new', context: organization(5) });
    });

    it('matches a parameterized context route under an organization', () => {
      expect(resolve('#/orgs/5/x/9?y=1', FIXTURES)).toEqual({ page: 'x-show', context: organization(5) });
    });

    it('matches a parameterized context route as Personal', () => {
      expect(resolve('#/x/9', FIXTURES)).toEqual({ page: 'x-show', context: PERSONAL });
    });

    it('does not use the fixture routes by default', () => {
      expect(resolve('#/orgs/5/x')).toEqual({ page: 'home', context: PERSONAL });
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
