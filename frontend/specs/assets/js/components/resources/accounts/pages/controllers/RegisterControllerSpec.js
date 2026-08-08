import RegisterController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/RegisterController.js';
import AuthEvents from '../../../../../../../../assets/js/client/AuthEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

describe('RegisterController', () => {
  let setFieldErrors;
  let setSubmitError;
  let client;

  const validFields = {
    username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
  };

  const invalidCases = [
    { description: 'flags a missing username', override: { username: '' }, field: 'username' },
    { description: 'flags a missing email', override: { email: '' }, field: 'email' },
    { description: 'flags a malformed email', override: { email: 'not-an-email' }, field: 'email' },
    { description: 'flags a missing password', override: { password: '' }, field: 'password' },
    {
      description: 'flags a missing password confirmation',
      override: { passwordConfirmation: '' },
      field: 'passwordConfirmation',
    },
    {
      description: 'flags a mismatched password confirmation',
      override: { passwordConfirmation: 'other' },
      field: 'passwordConfirmation',
    },
  ];

  const buildController = () => new RegisterController(setFieldErrors, setSubmitError, client);

  const submitSuccessfully = async ({ isAdmin }) => {
    client.register.and.resolveTo({
      user: {
        id: 1, username: 'foo', email: 'foo@example.com', isAdmin,
      },
      refreshToken: 'refresh-token',
    });
    const controller = buildController();
    const fakeWindow = installFakeWindow({ location: { hash: '' } });

    await controller.handleSubmit(validFields);

    return fakeWindow;
  };

  beforeEach(() => {
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', ['register']);
    spyOn(AuthEvents, 'emit');
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('#validate', () => {
    it('returns no errors for a valid form', () => {
      const controller = buildController();

      expect(controller.validate(validFields)).toEqual({});
    });

    invalidCases.forEach(({ description, override, field }) => {
      it(description, () => {
        const controller = buildController();

        expect(Object.keys(controller.validate({ ...validFields, ...override }))).toContain(field);
      });
    });
  });

  describe('#handleSubmit', () => {
    it('sets field errors and skips the API call when the form is invalid', async () => {
      const controller = buildController();

      await controller.handleSubmit({ ...validFields, username: '' });

      expect(setFieldErrors).toHaveBeenCalledWith(jasmine.objectContaining({ username: jasmine.any(String) }));
      expect(client.register).not.toHaveBeenCalled();
    });

    it('clears field errors and redirects home on success', async () => {
      const fakeWindow = await submitSuccessfully({ isAdmin: false });

      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(client.register).toHaveBeenCalledWith(validFields);
      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(fakeWindow.location.hash).toBe('/');
    });

    it('emits the logged-in auth state on success', async () => {
      await submitSuccessfully({ isAdmin: true });

      expect(AuthEvents.emit).toHaveBeenCalledWith(true, true);
    });

    it('sets a submit error when the request fails', async () => {
      client.register.and.rejectWith(new Error('username is not available'));
      const controller = buildController();

      await controller.handleSubmit(validFields);

      expect(setSubmitError).toHaveBeenCalledWith('username is not available');
    });
  });
});
