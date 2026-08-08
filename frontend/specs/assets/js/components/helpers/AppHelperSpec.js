import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppHelper from '../../../../../assets/js/components/helpers/AppHelper.jsx';
import LoginModal from '../../../../../assets/js/components/common/loginModal/LoginModal.jsx';
import ModalRedirect from '../../../../../assets/js/components/common/ModalRedirect.jsx';
import ResetPasswordLanding from '../../../../../assets/js/components/resources/accounts/pages/ResetPasswordLanding.jsx';

describe('AppHelper', () => {
  const markupFor = (page) => renderToStaticMarkup(
    React.createElement('div', null, AppHelper.render(page)),
  );

  const partsOf = (page) => {
    const [header, loginModal] = AppHelper.render(page).props.children;
    return { page: header.props.children, loginModal };
  };

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
