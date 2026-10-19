import AdminUsersController, { DENY_CONFIRM_MESSAGE } from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUsersController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

describe('AdminUsersController', () => {
  let setUsers;
  let setCurrentUserId;
  let setRowResults;
  let setSearchError;
  let client;
  let confirm;

  const users = [{
    id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false, createdAt: '2026-01-01',
  }];

  const buildController = () => (
    new AdminUsersController({
      setUsers, setCurrentUserId, setRowResults, setSearchError, client, confirm,
    })
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
    setCurrentUserId = jasmine.createSpy('setCurrentUserId');
    setRowResults = jasmine.createSpy('setRowResults');
    setSearchError = jasmine.createSpy('setSearchError');
    client = jasmine.createSpyObj('client', [
      'searchUsers', 'approveUser', 'denyUser', 'generateRecoveryLink', 'sendRecoveryEmail',
    ]);
    confirm = jasmine.createSpy('confirm').and.returnValue(true);
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('#handleSearch', () => {
    it('clears the search error and stores the returned users', async () => {
      client.searchUsers.and.resolveTo({ users, currentUserId: 7 });
      const controller = buildController();

      await controller.handleSearch('foo');

      expect(setSearchError).toHaveBeenCalledWith(null);
      expect(client.searchUsers).toHaveBeenCalledWith('foo', undefined);
      expect(setUsers).toHaveBeenCalledWith(users);
    });

    it('stores the returned currentUserId', async () => {
      client.searchUsers.and.resolveTo({ users, currentUserId: 7 });
      const controller = buildController();

      await controller.handleSearch('foo');

      expect(setCurrentUserId).toHaveBeenCalledWith(7);
    });

    it('passes the status filter to the client', async () => {
      client.searchUsers.and.resolveTo({ users, currentUserId: 7 });
      const controller = buildController();

      await controller.handleSearch('foo', 'pending');

      expect(client.searchUsers).toHaveBeenCalledWith('foo', 'pending');
    });

    it('sends no status for "all"', async () => {
      client.searchUsers.and.resolveTo({ users, currentUserId: 7 });
      const controller = buildController();

      await controller.handleSearch('', undefined);

      expect(client.searchUsers.calls.mostRecent().args[1]).toBeUndefined();
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

  describe('#handleApprove', () => {
    const approved = { ...users[0], status: 'approved' };

    it('replaces the user row with the returned user', async () => {
      client.approveUser.and.resolveTo({ user: approved });
      const controller = buildController();

      await controller.handleApprove(1);

      expect(client.approveUser).toHaveBeenCalledWith(1);
      const updater = setUsers.calls.mostRecent().args[0];
      const other = { id: 2, username: 'bar', status: 'pending' };

      expect(updater([{ ...users[0], status: 'pending' }, other])).toEqual([approved, other]);
    });

    it('clears a stale row result for the replaced user', async () => {
      client.approveUser.and.resolveTo({ user: approved });
      const controller = buildController();

      await controller.handleApprove(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({ 1: { error: 'old' }, 2: { sent: true } })).toEqual({ 2: { sent: true } });
    });

    it('shows a 422 message in the row and leaves the users unchanged', async () => {
      client.approveUser.and.rejectWith(new ApiError(422, 'User is not pending'));
      const controller = buildController();

      await controller.handleApprove(1);

      expect(setUsers).not.toHaveBeenCalled();
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'User is not pending' } });
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.approveUser,
      act: (controller) => controller.handleApprove(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });
  });

  describe('#handleDeny', () => {
    const denied = { ...users[0], status: 'denied' };

    it('asks for confirmation with the deny message', async () => {
      client.denyUser.and.resolveTo({ user: denied });
      const controller = buildController();

      await controller.handleDeny(1);

      expect(confirm).toHaveBeenCalledWith(DENY_CONFIRM_MESSAGE);
    });

    it('sends no request when the confirmation is cancelled', async () => {
      confirm.and.returnValue(false);
      const controller = buildController();

      await controller.handleDeny(1);

      expect(client.denyUser).not.toHaveBeenCalled();
      expect(setUsers).not.toHaveBeenCalled();
      expect(setRowResults).not.toHaveBeenCalled();
    });

    it('replaces the user row with the returned user', async () => {
      client.denyUser.and.resolveTo({ user: denied });
      const controller = buildController();

      await controller.handleDeny(1);

      expect(client.denyUser).toHaveBeenCalledWith(1);
      const updater = setUsers.calls.mostRecent().args[0];

      expect(updater([{ ...users[0], status: 'approved' }])).toEqual([denied]);
    });

    it('shows a 422 message in the row and leaves the users unchanged', async () => {
      client.denyUser.and.rejectWith(new ApiError(422, 'Cannot deny yourself'));
      const controller = buildController();

      await controller.handleDeny(1);

      expect(setUsers).not.toHaveBeenCalled();
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'Cannot deny yourself' } });
    });

    it('shows a 404 message in the row', async () => {
      client.denyUser.and.rejectWith(new ApiError(404, 'Not found'));
      const controller = buildController();

      await controller.handleDeny(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'Not found' } });
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.denyUser,
      act: (controller) => controller.handleDeny(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });

    it('defaults to window.confirm', async () => {
      const fakeConfirm = jasmine.createSpy('confirm').and.returnValue(false);
      installFakeWindow({ location: { hash: '' }, confirm: fakeConfirm });
      const controller = new AdminUsersController({
        setUsers, setCurrentUserId, setRowResults, setSearchError, client,
      });

      await controller.handleDeny(1);

      expect(fakeConfirm).toHaveBeenCalledWith(DENY_CONFIRM_MESSAGE);
      expect(client.denyUser).not.toHaveBeenCalled();
    });
  });
});
