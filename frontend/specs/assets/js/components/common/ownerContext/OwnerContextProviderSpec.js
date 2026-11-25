import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OwnerContextProvider, {
  buildOwnerContextValue,
} from '../../../../../../assets/js/components/common/ownerContext/OwnerContextProvider.jsx';
import useOwnerContext from '../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';

const PERSONAL = { kind: 'personal' };
const ORGS = [{ id: 5, name: 'Acme', role: 'admin' }, { id: 6, name: 'Beta', role: 'user' }];

function orgState(overrides = {}) {
  return {
    userId: 1, orgs: ORGS, orgsLoaded: true, orgsError: null, ...overrides,
  };
}

describe('OwnerContextProvider', () => {
  describe('buildOwnerContextValue', () => {
    const refreshOrgs = () => Promise.resolve();

    it('exposes the route, the org-list state and the refresher', () => {
      const route = { page: 'home', context: PERSONAL };

      expect(buildOwnerContextValue(route, orgState(), refreshOrgs)).toEqual({
        context: PERSONAL,
        page: 'home',
        userId: 1,
        orgs: ORGS,
        orgsLoaded: true,
        orgsError: null,
        refreshOrgs,
        role: 'owner',
        refreshRole: refreshOrgs,
      });
    });

    it('resolves owner in the Personal context, even before the list loads', () => {
      const value = buildOwnerContextValue({ page: 'home', context: PERSONAL }, orgState({ orgs: [] }), refreshOrgs);

      expect(value.role).toBe('owner');
    });

    it('resolves the listed organization role', () => {
      const route = { page: 'x', context: { kind: 'organization', orgId: 6 } };

      expect(buildOwnerContextValue(route, orgState(), refreshOrgs).role).toBe('user');
    });

    it('resolves null for an organization not in the list', () => {
      const route = { page: 'x', context: { kind: 'organization', orgId: 9 } };

      expect(buildOwnerContextValue(route, orgState(), refreshOrgs).role).toBeNull();
    });

    it('resolves null while the list is loading', () => {
      const route = { page: 'x', context: { kind: 'organization', orgId: 5 } };
      const loading = orgState({ orgs: [], orgsLoaded: false });

      expect(buildOwnerContextValue(route, loading, refreshOrgs).role).toBeNull();
    });

    it('uses the list refetch as refreshRole', () => {
      const value = buildOwnerContextValue({ page: 'home', context: PERSONAL }, orgState(), refreshOrgs);

      expect(value.refreshRole).toBe(value.refreshOrgs);
    });
  });

  describe('rendering', () => {
    it('renders its children with the route context and an empty list', () => {
      let captured;
      const Probe = () => {
        captured = useOwnerContext();
        return createElement('span', null, 'child');
      };
      const route = { page: 'x', context: { kind: 'organization', orgId: 5 } };

      const markup = renderToStaticMarkup(createElement(OwnerContextProvider, { route }, createElement(Probe)));

      expect(markup).toBe('<span>child</span>');
      expect(captured.context).toEqual(route.context);
      expect(captured.page).toBe('x');
      expect(captured.orgs).toEqual([]);
      expect(captured.orgsLoaded).toBeFalse();
      expect(captured.role).toBeNull();
    });
  });
});
