import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeaderHelper from '../../../../../../../assets/js/components/common/header/helpers/HeaderHelper.jsx';

describe('HeaderHelper', () => {
  const onLogout = jasmine.createSpy('onLogout');
  const onOpenLogin = jasmine.createSpy('onOpenLogin');

  const render = (isLoggedIn, isAdmin) => HeaderHelper.render(isLoggedIn, isAdmin, onLogout, onOpenLogin);
  const markupOf = (isLoggedIn, isAdmin) => renderToStaticMarkup(
    React.createElement('div', null, render(isLoggedIn, isAdmin)),
  );

  const flatten = (node, acc = []) => {
    if (Array.isArray(node)) {
      node.forEach((child) => flatten(child, acc));
      return acc;
    }

    if (!node || typeof node !== 'object') {
      return acc;
    }

    acc.push(node);
    return flatten(node.props?.children, acc);
  };

  const clickLink = (element, label) => {
    const link = flatten(element).find((node) => node.props?.children === label);
    link.props.onClick({ preventDefault: jasmine.createSpy('preventDefault') });
  };

  beforeEach(() => {
    onLogout.calls.reset();
    onOpenLogin.calls.reset();
  });

  it('renders the brand link to home', () => {
    expect(markupOf(false, false)).toContain('href="#/"');
  });

  describe('when logged out', () => {
    it('renders a Login link that opens the modal in password mode', () => {
      const markup = markupOf(false, false);

      expect(markup).toContain('Login');

      clickLink(render(false, false), 'Login');

      expect(onOpenLogin).toHaveBeenCalledWith('password');
    });

    it('renders a Register link that opens the modal in register mode', () => {
      const markup = markupOf(false, false);

      expect(markup).toContain('Register');

      clickLink(render(false, false), 'Register');

      expect(onOpenLogin).toHaveBeenCalledWith('register');
    });

    it('renders a Recover link that opens the modal in recover mode', () => {
      const markup = markupOf(false, false);

      expect(markup).toContain('Recover');
      expect(markup).not.toContain('href="#/recover"');

      clickLink(render(false, false), 'Recover');

      expect(onOpenLogin).toHaveBeenCalledWith('recover');
    });

    it('does not render the Logout action', () => {
      expect(markupOf(false, false)).not.toContain('Logout');
    });

    it('does not render the Admin Users link, even when isAdmin is true', () => {
      expect(markupOf(false, true)).not.toContain('href="#/admin/users"');
    });

    it('does not render the My account dropdown', () => {
      expect(markupOf(false, false)).not.toContain('My account');
    });
  });

  describe('when logged in', () => {
    it('renders the Logout action', () => {
      expect(markupOf(true, false)).toContain('Logout');
    });

    it('does not render the Login, Register, or Recover links', () => {
      const markup = markupOf(true, false);

      expect(markup).not.toContain('>Login<');
      expect(markup).not.toContain('>Register<');
      expect(markup).not.toContain('>Recover<');
    });

    it('does not render the Admin Users link for a non-admin', () => {
      expect(markupOf(true, false)).not.toContain('href="#/admin/users"');
    });

    it('renders the Admin Users link for an admin', () => {
      const markup = markupOf(true, true);

      expect(markup).toContain('href="#/admin/users"');
      expect(markup).toContain('Admin Users');
    });

    it('renders the My account dropdown with an Authorizations item', () => {
      const markup = markupOf(true, false);

      expect(markup).toContain('My account');
      expect(markup).toContain('href="#/account/authorization-requests"');
      expect(markup).toContain('Authorizations');
    });
  });
});
