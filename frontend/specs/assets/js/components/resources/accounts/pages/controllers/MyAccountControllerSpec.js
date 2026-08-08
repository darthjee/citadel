import MyAccountController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/MyAccountController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { itBehavesLikeAnAccountEditFormController } from '../../../../../../../support/accountEditFormControllerExamples.js';

describe('MyAccountController', () => {
  const blankFields = {
    username: '',
    email: '',
    currentPassword: 'secret',
    newPassword: '',
    newPasswordConfirmation: '',
  };

  const context = itBehavesLikeAnAccountEditFormController({
    ControllerClass: MyAccountController,
    clientMethod: 'updateAccount',
    blankFields,
    submit: (controller, fields) => controller.handleSubmit(fields),
    wrapResponse: (account) => account,
    expectedClientArgs: (payload) => [{ currentPassword: 'secret', ...payload }],
  });

  describe('#validate', () => {
    it('returns no errors for a form with only the current password filled in', () => {
      const controller = context.buildController();

      expect(controller.validate(blankFields)).toEqual({});
    });

    it('flags a missing current password', () => {
      const controller = context.buildController();

      expect(
        controller.validate({ ...blankFields, currentPassword: '' }).currentPassword,
      ).toBeDefined();
    });
  });

  describe('#handleSubmit', () => {
    it('sets currentPassword field errors and skips the API call when it is missing', async () => {
      const controller = context.buildController();

      await controller.handleSubmit({ ...blankFields, currentPassword: '' });

      expect(context.setFieldErrors).toHaveBeenCalledWith(
        jasmine.objectContaining({ currentPassword: jasmine.any(String) }),
      );
      expect(context.client.updateAccount).not.toHaveBeenCalled();
    });

    it('also clears the current password field on success', async () => {
      context.client.updateAccount.and.resolveTo({ username: 'newname', email: 'foo@example.com' });
      const controller = context.buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      const updater = context.setFields.calls.mostRecent().args[0];
      expect(updater({ username: 'old', email: 'foo@example.com', currentPassword: 'secret' }))
        .toEqual({
          username: 'newname',
          email: 'foo@example.com',
          currentPassword: '',
          newPassword: '',
          newPasswordConfirmation: '',
        });
    });

    it('stores the submit error and does not update the fields on a wrong current password', async () => {
      context.client.updateAccount.and.rejectWith(new ApiError(400, 'Invalid current password'));
      const controller = context.buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      expect(context.setSubmitError).toHaveBeenCalledWith('Invalid current password');
      expect(context.setFields).not.toHaveBeenCalled();
      expect(context.setSuccess).not.toHaveBeenCalledWith(true);
    });
  });
});
