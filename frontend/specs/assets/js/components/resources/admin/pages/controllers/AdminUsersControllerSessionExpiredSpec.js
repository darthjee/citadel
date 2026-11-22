import AdminUsersController from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUsersController.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

describe('AdminUsersController on a session-expired rejection', () => {
  let setSearchError;
  let setRowResults;
  let client;
  let controller;

  beforeEach(() => {
    setSearchError = jasmine.createSpy('setSearchError');
    setRowResults = jasmine.createSpy('setRowResults');
    client = jasmine.createSpyObj('client', ['searchUsers', 'approveUser']);
    controller = new AdminUsersController({
      setUsers: jasmine.createSpy('setUsers'),
      setCurrentUserId: jasmine.createSpy('setCurrentUserId'),
      setRowResults,
      setSearchError,
      client,
      confirm: () => true,
    });
  });

  it('does not set a search error', async () => {
    client.searchUsers.and.rejectWith(sessionExpiredError());

    await controller.handleSearch('foo');

    expect(setSearchError).not.toHaveBeenCalledWith(jasmine.any(String));
  });

  it('does not set a row error', async () => {
    client.approveUser.and.rejectWith(sessionExpiredError());

    await controller.handleApprove(1);

    expect(setRowResults).not.toHaveBeenCalled();
  });
});
