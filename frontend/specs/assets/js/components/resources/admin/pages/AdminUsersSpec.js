import React from 'react';
import AdminUsers from '../../../../../../../assets/js/components/resources/admin/pages/AdminUsers.jsx';
import AdminUsersHelper from '../../../../../../../assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx';
import AdminUsersController from '../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUsersController.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('AdminUsers', () => {
  it('passes the default state to the helper', () => {
    spyOn(AdminUsersHelper, 'render').and.returnValue(React.createElement('div', null, 'admin-users'));

    const page = renderedOutput(React.createElement(AdminUsers));

    expect(page.contains('admin-users')).toBeTrue();
    expect(AdminUsersHelper.render).toHaveBeenCalledWith(
      {
        query: '', users: [], rowResults: {}, searchError: null,
      },
      jasmine.objectContaining({
        onSubmit: jasmine.any(Function),
        onQueryChange: jasmine.any(Function),
        onGenerateLink: jasmine.any(Function),
        onSendEmail: jasmine.any(Function),
      }),
    );
  });

  it('submits the current query and prevents the default navigation', async () => {
    spyOn(AdminUsersController.prototype, 'handleSearch').and.resolveTo();
    const handlers = renderCapturingHandlers(AdminUsers, AdminUsersHelper);
    const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };

    await handlers.onSubmit(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(AdminUsersController.prototype.handleSearch).toHaveBeenCalledWith('');
  });

  it('delegates generate-link clicks to the controller for the given user id', async () => {
    spyOn(AdminUsersController.prototype, 'handleGenerateLink').and.resolveTo();
    const handlers = renderCapturingHandlers(AdminUsers, AdminUsersHelper);
    await handlers.onGenerateLink(42)();

    expect(AdminUsersController.prototype.handleGenerateLink).toHaveBeenCalledWith(42);
  });

  it('delegates send-email clicks to the controller for the given user id', async () => {
    spyOn(AdminUsersController.prototype, 'handleSendEmail').and.resolveTo();
    const handlers = renderCapturingHandlers(AdminUsers, AdminUsersHelper);
    await handlers.onSendEmail(42)();

    expect(AdminUsersController.prototype.handleSendEmail).toHaveBeenCalledWith(42);
  });
});
