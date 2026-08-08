import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Header from '../../../../../../assets/js/components/common/header/Header.jsx';
import HeaderHelper from '../../../../../../assets/js/components/common/header/helpers/HeaderHelper.jsx';
import HeaderController from '../../../../../../assets/js/components/common/header/controllers/HeaderController.js';
import AuthSession from '../../../../../../assets/js/client/AuthSession.js';

describe('Header', () => {
  afterEach(() => {
    AuthSession.clear();
  });

  it('renders the navigation bar', () => {
    const markup = renderToStaticMarkup(React.createElement(Header, null));

    expect(markup).toContain('Citadel Placeholder');
  });

  it('renders its children', () => {
    const markup = renderToStaticMarkup(
      React.createElement(Header, null, React.createElement('p', null, 'page content')),
    );

    expect(markup).toContain('page content');
  });

  it('passes the logged-out state to HeaderHelper by default', () => {
    spyOn(HeaderHelper, 'render').and.callThrough();

    renderToStaticMarkup(React.createElement(Header, null));

    expect(HeaderHelper.render).toHaveBeenCalledWith(false, false, jasmine.any(Function), jasmine.any(Function));
  });

  it('passes the logged-in state to HeaderHelper when a refresh token is stored', () => {
    AuthSession.set('token');
    spyOn(HeaderHelper, 'render').and.callThrough();

    renderToStaticMarkup(React.createElement(Header, null));

    expect(HeaderHelper.render).toHaveBeenCalledWith(true, false, jasmine.any(Function), jasmine.any(Function));
  });

  it('logs out and prevents the default navigation when the logout handler fires', async () => {
    spyOn(HeaderController.prototype, 'handleLogout').and.resolveTo();
    let capturedHandler;
    spyOn(HeaderHelper, 'render').and.callFake((_isLoggedIn, _isAdmin, onLogout) => {
      capturedHandler = onLogout;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(Header, null));
    const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };

    await capturedHandler(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(HeaderController.prototype.handleLogout).toHaveBeenCalled();
  });

  it('opens the login modal through the controller when the open-login handler fires', () => {
    spyOn(HeaderController.prototype, 'openLoginModal');
    let capturedHandler;
    spyOn(HeaderHelper, 'render').and.callFake((_isLoggedIn, _isAdmin, _onLogout, onOpenLogin) => {
      capturedHandler = onOpenLogin;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(Header, null));
    capturedHandler('register');

    expect(HeaderController.prototype.openLoginModal).toHaveBeenCalledWith('register');
  });
});
