import React from 'react';
import ResetPasswordLanding, { redirectToResetModal } from '../../../../../../../assets/js/components/resources/accounts/pages/ResetPasswordLanding.jsx';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('ResetPasswordLanding', () => {

  beforeEach(() => {
    installFakeWindow({ location: { hash: '#/recover-password?token=abc' } });
    spyOn(LoginModalEvents, 'open');
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('redirectToResetModal', () => {
    it('opens the login modal in resetPassword mode with the hash token', () => {
      redirectToResetModal();

      expect(LoginModalEvents.open).toHaveBeenCalledWith('resetPassword', { token: 'abc' });
    });

    it('sends the URL hash back to the home route', () => {
      redirectToResetModal();

      expect(globalThis.window.location.hash).toBe('/');
    });

    it('passes a null token when the hash carries no token query param', () => {
      installFakeWindow({ location: { hash: '#/recover-password' } });

      redirectToResetModal();

      expect(LoginModalEvents.open).toHaveBeenCalledWith('resetPassword', { token: null });
    });
  });

  describe('component', () => {
    it('renders nothing', () => {
      const page = renderedOutput(React.createElement(ResetPasswordLanding));

      expect(page.isEmpty()).withContext('rendered output').toBeTrue();
    });
  });
});
