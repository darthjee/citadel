import AccountEditFormController from '../../../../../../../assets/js/components/common/forms/controllers/AccountEditFormController.js';

describe('AccountEditFormController', () => {
  let setFields;
  let setFieldErrors;
  let setSubmitError;
  let setSuccess;
  let client;
  let controller;

  const validFields = (overrides = {}) => ({
    username: '',
    email: '',
    newPassword: '',
    newPasswordConfirmation: '',
    ...overrides,
  });

  beforeEach(() => {
    setFields = jasmine.createSpy('setFields');
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    setSuccess = jasmine.createSpy('setSuccess');
    client = {};
    controller = new AccountEditFormController(
      setFields,
      setFieldErrors,
      setSubmitError,
      setSuccess,
      client,
    );
  });

  describe('#constructor', () => {
    it('stores the setters and the client', () => {
      expect(controller.setFields).toBe(setFields);
      expect(controller.setFieldErrors).toBe(setFieldErrors);
      expect(controller.setSubmitError).toBe(setSubmitError);
      expect(controller.setSuccess).toBe(setSuccess);
      expect(controller.client).toBe(client);
    });
  });

  describe('#validate', () => {
    it('returns no errors for a blank form', () => {
      expect(controller.validate(validFields())).toEqual({});
    });

    it('returns no errors for a well-formed email', () => {
      expect(controller.validate(validFields({ email: 'a@b.co' }))).toEqual({});
    });

    it('flags a malformed email', () => {
      expect(controller.validate(validFields({ email: 'nope' })))
        .toEqual({ email: 'Email is invalid' });
    });

    it('flags a too-short new password', () => {
      expect(controller.validate(validFields({ newPassword: 'short' })))
        .toEqual({ newPassword: 'Password must be at least 8 characters' });
    });

    it('flags a mismatching confirmation', () => {
      const fields = validFields({ newPassword: 'longenough', newPasswordConfirmation: 'other' });

      expect(controller.validate(fields))
        .toEqual({ newPasswordConfirmation: 'Passwords do not match' });
    });

    it('accepts a matching confirmation', () => {
      const fields = validFields({
        newPassword: 'longenough', newPasswordConfirmation: 'longenough',
      });

      expect(controller.validate(fields)).toEqual({});
    });
  });

  describe('#buildPayload', () => {
    it('includes only the filled-in fields', () => {
      const fields = validFields({ username: 'bob', email: '' });

      expect(controller.buildPayload(fields)).toEqual({ username: 'bob' });
    });

    it('never includes newPasswordConfirmation', () => {
      const fields = validFields({ newPassword: 'longenough', newPasswordConfirmation: 'longenough' });

      expect(controller.buildPayload(fields)).toEqual({ newPassword: 'longenough' });
    });

    it('returns an empty payload when nothing is filled in', () => {
      expect(controller.buildPayload(validFields())).toEqual({});
    });
  });

  describe('#hasUpdate', () => {
    it('is false for an empty payload', () => {
      expect(controller.hasUpdate({})).toBe(false);
    });

    it('is true when username is present', () => {
      expect(controller.hasUpdate({ username: 'bob' })).toBe(true);
    });

    it('is true when email is present', () => {
      expect(controller.hasUpdate({ email: 'a@b.co' })).toBe(true);
    });

    it('is true when newPassword is present', () => {
      expect(controller.hasUpdate({ newPassword: 'longenough' })).toBe(true);
    });
  });

  describe('default hooks', () => {
    it('#extractAccount returns the result itself', () => {
      const result = { username: 'bob', email: 'a@b.co' };

      expect(controller.extractAccount(result)).toBe(result);
    });

    it('#clearedFields clears the new-password fields', () => {
      expect(controller.clearedFields())
        .toEqual({ newPassword: '', newPasswordConfirmation: '' });
    });

    it('#handleSubmitError sets the submit error to the error message', () => {
      controller.handleSubmitError(new Error('boom'));

      expect(setSubmitError).toHaveBeenCalledWith('boom');
    });
  });

  describe('#applySuccess', () => {
    it('reflects username/email and clears the cleared fields via setFields', () => {
      controller.applySuccess({ username: 'bob', email: 'a@b.co' });

      const updater = setFields.calls.mostRecent().args[0];
      const current = {
        username: 'old', email: 'old@b.co', newPassword: 'x', newPasswordConfirmation: 'x',
        other: 'kept',
      };

      expect(updater(current)).toEqual({
        username: 'bob',
        email: 'a@b.co',
        newPassword: '',
        newPasswordConfirmation: '',
        other: 'kept',
      });
    });

    it('flags success', () => {
      controller.applySuccess({ username: 'bob', email: 'a@b.co' });

      expect(setSuccess).toHaveBeenCalledWith(true);
    });

    it('honours overridden hooks', () => {
      controller.extractAccount = ({ user }) => user;
      controller.clearedFields = () => ({ secret: '' });

      controller.applySuccess({ user: { username: 'bob', email: 'a@b.co' } });

      const updater = setFields.calls.mostRecent().args[0];

      expect(updater({ secret: 'x', newPassword: 'kept' })).toEqual({
        username: 'bob', email: 'a@b.co', secret: '', newPassword: 'kept',
      });
    });
  });

  describe('#submit', () => {
    let send;

    beforeEach(() => {
      send = jasmine.createSpy('send').and.resolveTo({ username: 'bob', email: 'a@b.co' });
    });

    it('sets field errors and skips send when validation fails', async () => {
      await controller.submit(validFields({ email: 'nope' }), send);

      expect(setFieldErrors).toHaveBeenCalledWith({ email: 'Email is invalid' });
      expect(send).not.toHaveBeenCalled();
    });

    it('resets the success flag before validating', async () => {
      await controller.submit(validFields({ email: 'nope' }), send);

      expect(setSuccess).toHaveBeenCalledWith(false);
      expect(setSuccess).not.toHaveBeenCalledWith(true);
    });

    it('sets a submit error and skips send when nothing is filled in', async () => {
      await controller.submit(validFields(), send);

      expect(setSubmitError)
        .toHaveBeenCalledWith('Provide a username, email, or new password to update.');
      expect(send).not.toHaveBeenCalled();
    });

    it('clears the submit error and sends the payload when there is an update', async () => {
      await controller.submit(validFields({ username: 'bob' }), send);

      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(send).toHaveBeenCalledWith({ username: 'bob' });
    });

    it('applies the response on success', async () => {
      await controller.submit(validFields({ username: 'bob' }), send);

      expect(setFields).toHaveBeenCalled();
      expect(setSuccess).toHaveBeenCalledWith(true);
    });

    it('ignores a falsy result', async () => {
      send.and.resolveTo(undefined);

      await controller.submit(validFields({ username: 'bob' }), send);

      expect(setFields).not.toHaveBeenCalled();
      expect(setSuccess).not.toHaveBeenCalledWith(true);
    });

    it('routes a thrown error to handleSubmitError', async () => {
      send.and.rejectWith(new Error('boom'));

      await controller.submit(validFields({ username: 'bob' }), send);

      expect(setSubmitError).toHaveBeenCalledWith('boom');
      expect(setSuccess).not.toHaveBeenCalledWith(true);
    });

    it('uses an overridden handleSubmitError', async () => {
      controller.handleSubmitError = jasmine.createSpy('handleSubmitError');
      const error = new Error('boom');

      send.and.rejectWith(error);

      await controller.submit(validFields({ username: 'bob' }), send);

      expect(controller.handleSubmitError).toHaveBeenCalledWith(error);
    });
  });
});
