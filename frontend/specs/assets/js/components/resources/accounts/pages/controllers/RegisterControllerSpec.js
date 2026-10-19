import RegisterController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/RegisterController.js';
import AuthEvents from '../../../../../../../../assets/js/client/AuthEvents.js';
import AuthSession from '../../../../../../../../assets/js/client/AuthSession.js';
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

  const submitSuccessfully = async (statusAnswer) => {
    client.register.and.callFake(async () => {
      AuthSession.set('refresh-token');
      return { user: { id: 1, username: 'foo', isAdmin: true }, refreshToken: 'refresh-token' };
    });
    client.status.and.resolveTo(statusAnswer);
    const controller = buildController();
    const fakeWindow = installFakeWindow({ location: { hash: '' } });

    await controller.handleSubmit(validFields);

    return fakeWindow;
  };

  beforeEach(() => {
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', ['register', 'status']);
    spyOn(AuthEvents, 'emit');
  });

  afterEach(() => {
    uninstallFakeWindow();
    AuthSession.clear();
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
      const fakeWindow = await submitSuccessfully({ loggedIn: true, isAdmin: false });

      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(client.register).toHaveBeenCalledWith(validFields);
      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(fakeWindow.location.hash).toBe('/');
    });

    it('re-checks the status and emits the logged-in auth state from its answer', async () => {
      await submitSuccessfully({ loggedIn: true, isAdmin: false });

      expect(client.status).toHaveBeenCalledWith('refresh-token');
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false, false);
    });

    it('emits the pending state and keeps the token when the user awaits approval', async () => {
      const fakeWindow = await submitSuccessfully({ loggedIn: false, isAdmin: false, status: 'pending' });

      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, true);
      expect(AuthSession.get()).toBe('refresh-token');
      expect(fakeWindow.location.hash).toBe('/');
    });

    it('sets a submit error and does not redirect when the status re-check fails', async () => {
      client.register.and.resolveTo({ user: { isAdmin: false }, refreshToken: 'refresh-token' });
      AuthSession.set('refresh-token');
      client.status.and.rejectWith(new Error('network down'));
      const fakeWindow = installFakeWindow({ location: { hash: '' } });

      await buildController().handleSubmit(validFields);

      expect(setSubmitError).toHaveBeenCalledWith('network down');
      expect(fakeWindow.location.hash).toBe('');
    });

    it('sets a submit error when the request fails', async () => {
      client.register.and.rejectWith(new Error('username is not available'));
      const controller = buildController();

      await controller.handleSubmit(validFields);

      expect(setSubmitError).toHaveBeenCalledWith('username is not available');
    });
  });
});
