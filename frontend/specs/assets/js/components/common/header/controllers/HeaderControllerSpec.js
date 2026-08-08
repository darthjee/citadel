import HeaderController from '../../../../../../../assets/js/components/common/header/controllers/HeaderController.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('HeaderController', () => {
  let client;
  let controller;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['logout', 'status']);
    controller = new HeaderController(client);
    spyOn(AuthEvents, 'emit');
  });

  afterEach(() => {
    AuthSession.clear();
  });

  describe('#handleLogout', () => {
    let fakeWindow;

    beforeEach(() => {
      fakeWindow = installFakeWindow({ location: { hash: '' } });
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    it('logs out with the currently stored refresh token', async () => {
      AuthSession.set('refresh-token');
      client.logout.and.resolveTo();

      await controller.handleLogout();

      expect(client.logout).toHaveBeenCalledWith('refresh-token');
    });

    it('redirects home on success', async () => {
      client.logout.and.resolveTo();

      await controller.handleLogout();

      expect(fakeWindow.location.hash).toBe('/');
    });

    it('redirects home even when the logout request fails', async () => {
      client.logout.and.rejectWith(new Error('network error'));

      await controller.handleLogout();

      expect(fakeWindow.location.hash).toBe('/');
    });

    it('emits the logged-out auth state', async () => {
      client.logout.and.resolveTo();

      await controller.handleLogout();

      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });

    it('emits the logged-out auth state even when the logout request fails', async () => {
      client.logout.and.rejectWith(new Error('network error'));

      await controller.handleLogout();

      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });
  });

  describe('#openLoginModal', () => {
    it('opens the login modal in the given mode via LoginModalEvents', () => {
      spyOn(LoginModalEvents, 'open');

      controller.openLoginModal('register');

      expect(LoginModalEvents.open).toHaveBeenCalledWith('register');
    });
  });

  describe('#checkStatus', () => {
    it('emits false/false without calling the backend when there is no stored token', async () => {
      await controller.checkStatus();

      expect(client.status).not.toHaveBeenCalled();
      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });

    it('emits true and the admin flag, leaving the stored token untouched, when it is still active', async () => {
      AuthSession.set('refresh-token');
      client.status.and.resolveTo({ loggedIn: true, isAdmin: true });

      await controller.checkStatus();

      expect(client.status).toHaveBeenCalledWith('refresh-token');
      expect(AuthSession.get()).toBe('refresh-token');
      expect(AuthEvents.emit).toHaveBeenCalledWith(true, true);
    });

    it('clears the stored token and emits false when it is no longer active', async () => {
      AuthSession.set('refresh-token');
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false });

      await controller.checkStatus();

      expect(AuthSession.get()).toBeNull();
      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });
  });
});
