import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppHelper from '../../../../../assets/js/components/helpers/AppHelper.jsx';
import LoginModal from '../../../../../assets/js/components/common/loginModal/LoginModal.jsx';
import Header from '../../../../../assets/js/components/common/header/Header.jsx';
import ModalRedirect from '../../../../../assets/js/components/common/ModalRedirect.jsx';
import ResetPasswordLanding from '../../../../../assets/js/components/resources/accounts/pages/ResetPasswordLanding.jsx';
import OrganizationNew from '../../../../../assets/js/components/resources/organizations/pages/OrganizationNew.jsx';
import OrganizationOverview from '../../../../../assets/js/components/resources/organizations/pages/OrganizationOverview.jsx';
import OrganizationEdit from '../../../../../assets/js/components/resources/organizations/pages/OrganizationEdit.jsx';
import NotFound from '../../../../../assets/js/components/common/notFound/NotFound.jsx';
import HashRouteResolver from '../../../../../assets/js/utils/routing/HashRouteResolver.js';

const PERSONAL = { kind: 'personal' };

describe('AppHelper', () => {
  const routeFor = (page, context = PERSONAL) => ({ page, context });

  const markupFor = (page) => renderToStaticMarkup(
    React.createElement('div', null, AppHelper.render(routeFor(page))),
  );

  const partsOfRoute = (route) => {
    const [header, loginModal] = AppHelper.render(route).props.children;
    const keyed = header.props.children;
    return {
      header, keyed, page: keyed.props.children, loginModal,
    };
  };

  const partsOf = (page) => partsOfRoute(routeFor(page));

  it('redirects the register key into the register-mode modal', () => {
    const { page } = partsOf('register');

    expect(page.type).toBe(ModalRedirect);
    expect(page.props.mode).toBe('register');
  });

  it('redirects the login key into the password-mode modal', () => {
    const { page } = partsOf('login');

    expect(page.type).toBe(ModalRedirect);
    expect(page.props.mode).toBe('password');
  });

  it('mounts the login modal alongside the header, route-independent', () => {
    expect(partsOf('home').loginModal.type).toBe(LoginModal);
    expect(partsOf('reset-password').loginModal.type).toBe(LoginModal);
  });

  it('wraps the page in the header', () => {
    expect(partsOf('home').header.type).toBe(Header);
  });

  describe('context key', () => {
    it('keys the page as personal in the Personal context', () => {
      expect(partsOf('home').keyed.key).toBe('personal');
    });

    it('keys the page by the organization id', () => {
      expect(partsOfRoute(routeFor('org-edit', { kind: 'organization', orgId: 5 })).keyed.key).toBe('org-5');
    });

    it('gives two organizations different keys', () => {
      const first = partsOfRoute(routeFor('org-overview', { kind: 'organization', orgId: 1 })).keyed.key;
      const second = partsOfRoute(routeFor('org-overview', { kind: 'organization', orgId: 2 })).keyed.key;

      expect(first).not.toBe(second);
    });

    it('keys the page as personal without a context', () => {
      expect(partsOfRoute({ page: 'home' }).keyed.key).toBe('personal');
    });
  });

  [
    ['org-new', OrganizationNew],
    ['org-overview', OrganizationOverview],
    ['org-edit', OrganizationEdit],
    ['not-found', NotFound],
  ].forEach(([key, Page]) => {
    it(`maps the ${key} key to its page`, () => {
      expect(partsOf(key).page.type).toBe(Page);
    });
  });

  it('renders the Not-found view for a malformed organization id without any request', () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = jasmine.createSpy('fetch');

    try {
      const route = new HashRouteResolver(() => '#/orgs/abc').resolve();
      const markup = renderToStaticMarkup(React.createElement('div', null, AppHelper.render(route)));

      expect(markup).toContain('Not found');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('renders the reset-password landing for the reset-password key', () => {
    expect(partsOf('reset-password').page.type).toBe(ResetPasswordLanding);
  });

  it('falls back to the home page for the removed recover key', () => {
    expect(markupFor('recover')).toContain('Citadel Placeholder');
  });

  it('renders the admin users page for the admin-users key', () => {
    expect(markupFor('admin-users')).toContain('Admin Users');
  });

  it('renders the authorization requests page for the authorization-requests key', () => {
    expect(markupFor('authorization-requests')).toContain('Authorization Requests');
  });

  it('renders the home page for the home key', () => {
    expect(markupFor('home')).toContain('Citadel Placeholder');
  });

  it('falls back to the home page for an unknown key', () => {
    expect(markupFor('unknown')).toContain('Citadel Placeholder');
  });

  it('always renders the header', () => {
    expect(markupFor('home')).toContain('navbar');
  });
});
