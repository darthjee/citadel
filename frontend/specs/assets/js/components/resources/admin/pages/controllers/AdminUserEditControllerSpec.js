import AdminUserEditController from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import { itBehavesLikeAnAccountEditFormController } from '../../../../../../../support/accountEditFormControllerExamples.js';

describe('AdminUserEditController', () => {
  const blankFields = {
    username: '',
    email: '',
    newPassword: '',
    newPasswordConfirmation: '',
  };

  const context = itBehavesLikeAnAccountEditFormController({
    ControllerClass: AdminUserEditController,
    clientMethod: 'editUser',
    blankFields,
    submit: (controller, fields) => controller.handleSubmit(1, fields),
    wrapResponse: (account) => ({ user: account }),
    expectedClientArgs: (payload) => [1, payload],
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('#handleSubmit', () => {
    it('redirects home without setting a submit error on a 403', async () => {
      context.client.editUser.and.rejectWith(new ApiError(403, 'Forbidden'));
      const controller = context.buildController();
      const fakeWindow = installFakeWindow({ location: { hash: '' } });

      await controller.handleSubmit(1, { ...blankFields, username: 'newname' });

      expect(fakeWindow.location.hash).toBe('/');
      expect(context.setSubmitError).not.toHaveBeenCalledWith('Forbidden');
    });
  });
});
