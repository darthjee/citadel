import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useOwnerContext, {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';

describe('useOwnerContext', () => {
  let captured;

  const Probe = () => {
    captured = useOwnerContext();
    return null;
  };

  beforeEach(() => {
    captured = undefined;
  });

  it('returns the default value outside any provider', () => {
    renderToStaticMarkup(createElement(Probe));

    expect(captured).toBe(DEFAULT_OWNER_CONTEXT);
  });

  it('returns the provided value inside a provider', () => {
    const value = { context: { kind: 'organization', orgId: 5 }, role: 'user' };

    renderToStaticMarkup(createElement(OwnerContext.Provider, { value }, createElement(Probe)));

    expect(captured).toBe(value);
  });

  describe('DEFAULT_OWNER_CONTEXT', () => {
    it('is the Personal context with no user, orgs nor role', () => {
      expect(DEFAULT_OWNER_CONTEXT).toEqual(jasmine.objectContaining({
        context: { kind: 'personal' },
        page: 'home',
        userId: null,
        orgs: [],
        orgsLoaded: false,
        orgsError: null,
        role: null,
      }));
    });

    it('is frozen', () => {
      expect(Object.isFrozen(DEFAULT_OWNER_CONTEXT)).toBeTrue();
    });

    it('has resolving no-op refreshers', async () => {
      await expectAsync(DEFAULT_OWNER_CONTEXT.refreshOrgs()).toBeResolved();
      await expectAsync(DEFAULT_OWNER_CONTEXT.refreshRole()).toBeResolved();
    });
  });
});
