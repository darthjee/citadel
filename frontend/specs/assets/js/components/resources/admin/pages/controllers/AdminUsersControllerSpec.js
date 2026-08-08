import AdminUsersController from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUsersController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

describe('AdminUsersController', () => {
  let setUsers;
  let setRowResults;
  let setSearchError;
  let client;

  const users = [{
    id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false, createdAt: '2026-01-01',
  }];

  const buildController = () => (
    new AdminUsersController(setUsers, setRowResults, setSearchError, client)
  );

  const itRedirectsHomeOn403 = ({
    title, stub, act, assertUntouched,
  }) => {
    it(title, async () => {
      stub(client).and.rejectWith(new ApiError(403, 'Forbidden'));
      const controller = buildController();
      const fakeWindow = installFakeWindow({ location: { hash: '' } });

      await act(controller);

      expect(fakeWindow.location.hash).toBe('/');
      assertUntouched();
    });
  };

  beforeEach(() => {
    setUsers = jasmine.createSpy('setUsers');
    setRowResults = jasmine.createSpy('setRowResults');
    setSearchError = jasmine.createSpy('setSearchError');
    client = jasmine.createSpyObj('client', ['searchUsers', 'generateRecoveryLink', 'sendRecoveryEmail']);
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('#handleSearch', () => {
    it('clears the search error and stores the returned users', async () => {
      client.searchUsers.and.resolveTo({ users });
      const controller = buildController();

      await controller.handleSearch('foo');

      expect(setSearchError).toHaveBeenCalledWith(null);
      expect(client.searchUsers).toHaveBeenCalledWith('foo');
      expect(setUsers).toHaveBeenCalledWith(users);
    });

    it('sets a search error when the request fails', async () => {
      client.searchUsers.and.rejectWith(new Error('network error'));
      const controller = buildController();

      await controller.handleSearch('foo');

      expect(setSearchError).toHaveBeenCalledWith('network error');
      expect(setUsers).not.toHaveBeenCalled();
    });

    itRedirectsHomeOn403({
      title: 'redirects home without setting a search error on a 403',
      stub: (c) => c.searchUsers,
      act: (controller) => controller.handleSearch('foo'),
      assertUntouched: () => expect(setSearchError).not.toHaveBeenCalledWith('Forbidden'),
    });
  });

  describe('#handleGenerateLink', () => {
    it('stores the returned resetUrl against the user row', async () => {
      client.generateRecoveryLink.and.resolveTo({ resetUrl: 'https://example.com/reset?token=abc' });
      const controller = buildController();

      await controller.handleGenerateLink(1);

      expect(client.generateRecoveryLink).toHaveBeenCalledWith(1);
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { resetUrl: 'https://example.com/reset?token=abc' } });
    });

    it('stores the error against the user row when the request fails', async () => {
      client.generateRecoveryLink.and.rejectWith(new Error('not found'));
      const controller = buildController();

      await controller.handleGenerateLink(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'not found' } });
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.generateRecoveryLink,
      act: (controller) => controller.handleGenerateLink(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });
  });

  describe('#handleSendEmail', () => {
    it('stores the returned sent flag against the user row', async () => {
      client.sendRecoveryEmail.and.resolveTo({ sent: true });
      const controller = buildController();

      await controller.handleSendEmail(1);

      expect(client.sendRecoveryEmail).toHaveBeenCalledWith(1);
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { sent: true } });
    });

    it('stores the error against the user row when the request fails', async () => {
      client.sendRecoveryEmail.and.rejectWith(new Error('mail server unreachable'));
      const controller = buildController();

      await controller.handleSendEmail(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'mail server unreachable' } });
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.sendRecoveryEmail,
      act: (controller) => controller.handleSendEmail(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });
  });
});
