import AdminUserEdit from '../../../../../../../assets/js/components/resources/admin/pages/AdminUserEdit.jsx';
import AdminUserEditHelper from '../../../../../../../assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx';
import AdminUserEditController from '../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';
import { itBehavesLikeAnAccountEditPage } from '../../../../../../support/accountEditPageExamples.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('AdminUserEdit', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  itBehavesLikeAnAccountEditPage({
    Page: AdminUserEdit,
    Helper: AdminUserEditHelper,
    label: 'admin-user-edit',
    defaultState: {
      username: '',
      email: '',
      newPassword: '',
      newPasswordConfirmation: '',
      fieldErrors: {},
      submitError: null,
      success: false,
    },
  });

  it('delegates submission to the controller with the route user id and current fields, preventing default navigation', async () => {
    spyOn(AdminUserEditController.prototype, 'handleSubmit').and.resolveTo();
    installFakeWindow({ location: { hash: '#/admin/users/42/edit' } });

    const handlers = renderCapturingHandlers(AdminUserEdit, AdminUserEditHelper);
    const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };
    await handlers.onSubmit(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(AdminUserEditController.prototype.handleSubmit).toHaveBeenCalledWith('42', {
      username: '',
      email: '',
      newPassword: '',
      newPasswordConfirmation: '',
    });
  });

  it('updates a field locally on change, without reaching the controller', () => {
    spyOn(AdminUserEditController.prototype, 'handleSubmit').and.resolveTo();
    const handlers = renderCapturingHandlers(AdminUserEdit, AdminUserEditHelper);

    expect(() => handlers.onChange('username')({ target: { value: 'newname' } }))
      .not.toThrow();
    expect(AdminUserEditController.prototype.handleSubmit).not.toHaveBeenCalled();
  });
});
