import MyAccount from '../../../../../../../assets/js/components/resources/accounts/pages/MyAccount.jsx';
import MyAccountHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx';
import MyAccountController from '../../../../../../../assets/js/components/resources/accounts/pages/controllers/MyAccountController.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';
import { itBehavesLikeAnAccountEditPage } from '../../../../../../support/accountEditPageExamples.js';

describe('MyAccount', () => {
  itBehavesLikeAnAccountEditPage({
    Page: MyAccount,
    Helper: MyAccountHelper,
    label: 'my-account',
    defaultState: {
      username: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: '',
      fieldErrors: {},
      submitError: null,
      success: false,
    },
  });

  it('delegates submission to the controller with the current fields, preventing default navigation', async () => {
    spyOn(MyAccountController.prototype, 'handleSubmit').and.resolveTo();
    const handlers = renderCapturingHandlers(MyAccount, MyAccountHelper);
    const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };
    await handlers.onSubmit(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(MyAccountController.prototype.handleSubmit).toHaveBeenCalledWith({
      username: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: '',
    });
  });

  it('updates a field locally on change, without reaching the controller', () => {
    spyOn(MyAccountController.prototype, 'handleSubmit').and.resolveTo();
    const handlers = renderCapturingHandlers(MyAccount, MyAccountHelper);

    expect(() => handlers.onChange('username')({ target: { value: 'newname' } }))
      .not.toThrow();
    expect(MyAccountController.prototype.handleSubmit).not.toHaveBeenCalled();
  });
});
