import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import AuthorizationRequestPoller from '../../../../../../../assets/js/utils/polling/AuthorizationRequestPoller.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { flushMicrotasks as flush } from '../../../../../../support/flushMicrotasks.js';

describe('LoginModalController', () => {
  let setMode;
  let setFields;
  let setFieldErrors;
  let setSubmitError;
  let setResultPanel;
  let setDeviceExpiresAt;
  let client;

  const passwordFields = { username: 'foo', password: 'secret' };
  const registerFields = {
    username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
  };
  const recoverFields = { email: 'foo@example.com' };
  const resetFields = { password: 'secret', passwordConfirmation: 'secret' };
  const resetToken = 'reset-token';

  const build = () => new LoginModalController(
    setMode, setFields, setFieldErrors, setSubmitError, setResultPanel, setDeviceExpiresAt, client,
  );

  beforeEach(() => {
    setMode = jasmine.createSpy('setMode');
    setFields = jasmine.createSpy('setFields');
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    setResultPanel = jasmine.createSpy('setResultPanel');
    setDeviceExpiresAt = jasmine.createSpy('setDeviceExpiresAt');
    client = jasmine.createSpyObj('client', [
      'login', 'register', 'recover', 'resetPassword',
      'createAuthorizationRequest', 'pollAuthorizationRequest',
    ]);
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'close');
    installFakeWindow({ location: { hash: '' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('#switchMode', () => {
    it('sets the new mode and clears every field, error, and shown result panel', () => {
      build().switchMode('register');

      expect(setMode).toHaveBeenCalledWith('register');
      expect(setFields).toHaveBeenCalledWith({
        username: '', email: '', password: '', passwordConfirmation: '',
      });
      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(setResultPanel).toHaveBeenCalledWith(null);
    });

    it('tears down a running poller and clears the device expiry', () => {
      const controller = build();
      const poller = jasmine.createSpyObj('poller', ['stop']);
      controller.poller = poller;

      controller.switchMode('device');

      expect(poller.stop).toHaveBeenCalledTimes(1);
      expect(controller.poller).toBeNull();
      expect(setDeviceExpiresAt).toHaveBeenCalledWith(null);
    });
  });

  describe('#stopPoller', () => {
    it('is null-safe when no poll is running', () => {
      const controller = build();

      expect(() => controller.stopPoller()).not.toThrow();
      expect(controller.poller).toBeNull();
    });

    it('stops and drops the active poller', () => {
      const controller = build();
      const poller = jasmine.createSpyObj('poller', ['stop']);
      controller.poller = poller;

      controller.stopPoller();

      expect(poller.stop).toHaveBeenCalledTimes(1);
      expect(controller.poller).toBeNull();
    });
  });

  describe('#handleSubmit password mode', () => {
    it('clears the submit error, logs in, and runs the shared success path once', async () => {
      client.login.and.resolveTo({ user: { id: 1, username: 'foo', isAdmin: true }, refreshToken: 't' });

      await build().handleSubmit('password', passwordFields);

      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(client.login).toHaveBeenCalledWith(passwordFields);
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, true);
      expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
      expect(globalThis.window.location.hash).toBe('/');
    });

    it('sets a submit error and skips the success path when the request fails', async () => {
      client.login.and.rejectWith(new Error('invalid credentials'));

      await build().handleSubmit('password', passwordFields);

      expect(setSubmitError).toHaveBeenCalledWith('invalid credentials');
      expect(AuthEvents.emit).not.toHaveBeenCalled();
      expect(LoginModalEvents.close).not.toHaveBeenCalled();
    });

    it('falls back to the password submit for an unknown mode', async () => {
      client.login.and.resolveTo({ user: { isAdmin: false } });
      await build().handleSubmit('bogus', passwordFields);

      expect(client.login).toHaveBeenCalledWith(passwordFields);
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false);
      expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('#handleSubmit register mode', () => {
    it('sets field errors and skips the API call when the form is invalid', async () => {
      await build().handleSubmit('register', { ...registerFields, email: 'nope' });

      expect(setFieldErrors).toHaveBeenCalledWith(jasmine.objectContaining({ email: jasmine.any(String) }));
      expect(client.register).not.toHaveBeenCalled();
    });

    it('registers and runs the shared success path once on a clean form', async () => {
      client.register.and.resolveTo({ user: { id: 1, username: 'foo', isAdmin: false }, refreshToken: 't' });

      await build().handleSubmit('register', registerFields);

      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(client.register).toHaveBeenCalledWith(registerFields);
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false);
      expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
      expect(globalThis.window.location.hash).toBe('/');
    });

    it('sets a submit error when the register request fails', async () => {
      client.register.and.rejectWith(new Error('username is not available'));

      await build().handleSubmit('register', registerFields);

      expect(setSubmitError).toHaveBeenCalledWith('username is not available');
      expect(AuthEvents.emit).not.toHaveBeenCalled();
    });
  });

  describe('#handleSubmit recover mode', () => {
    it('requests a recovery email, shows the neutral panel, and never announces auth state', async () => {
      client.recover.and.resolveTo({ sent: true });

      await build().handleSubmit('recover', recoverFields);

      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(client.recover).toHaveBeenCalledWith('foo@example.com');
      expect(setResultPanel).toHaveBeenCalledWith('recover');
      expect(AuthEvents.emit).not.toHaveBeenCalled();
      expect(LoginModalEvents.close).not.toHaveBeenCalled();
    });

    it('still shows the neutral panel when the recovery request fails', async () => {
      client.recover.and.rejectWith(new Error('network down'));

      await expectAsync(build().handleSubmit('recover', recoverFields)).toBeRejected();

      expect(setResultPanel).toHaveBeenCalledWith('recover');
    });
  });

  describe('#handleSubmit resetPassword mode', () => {
    it('sets field errors and skips the API call when the form is invalid', async () => {
      await build().handleSubmit('resetPassword', { ...resetFields, password: '' }, resetToken);

      expect(setFieldErrors).toHaveBeenCalledWith(jasmine.objectContaining({ password: jasmine.any(String) }));
      expect(client.resetPassword).not.toHaveBeenCalled();
    });

    it('submits the token and new password and shows the success panel', async () => {
      client.resetPassword.and.resolveTo({ reset: true });

      await build().handleSubmit('resetPassword', resetFields, resetToken);

      expect(client.resetPassword).toHaveBeenCalledWith({ token: resetToken, ...resetFields });
      expect(setResultPanel).toHaveBeenCalledWith('resetPassword');
      expect(AuthEvents.emit).not.toHaveBeenCalled();
      expect(LoginModalEvents.close).not.toHaveBeenCalled();
      expect(globalThis.window.location.hash).toBe('');
    });

    it('sets a submit error and shows no panel when the request fails', async () => {
      client.resetPassword.and.rejectWith(new Error('Invalid or expired token'));

      await build().handleSubmit('resetPassword', resetFields, resetToken);

      expect(setSubmitError).toHaveBeenCalledWith('Invalid or expired token');
      expect(setResultPanel).not.toHaveBeenCalledWith('resetPassword');
    });
  });

  describe('#handleSubmit device mode', () => {
    const deviceFields = { username: 'foo' };
    const request = { uuid: 'req-uuid', pollToken: 'poll-token', expiresAt: '2999-01-01T00:00:00.000Z' };

    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('opens an authorization request, shows the waiting panel and starts polling', async () => {
      client.createAuthorizationRequest.and.resolveTo(request);
      client.pollAuthorizationRequest.and.resolveTo({ status: 'open' });
      const controller = build();

      await controller.handleSubmit('device', deviceFields);

      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(client.createAuthorizationRequest).toHaveBeenCalledWith('foo');
      expect(setDeviceExpiresAt).toHaveBeenCalledWith(request.expiresAt);
      expect(setResultPanel).toHaveBeenCalledWith('device:waiting');
      expect(controller.poller).toBeInstanceOf(AuthorizationRequestPoller);

      jasmine.clock().tick(5000);
      await flush();

      expect(client.pollAuthorizationRequest).toHaveBeenCalledWith('req-uuid', 'poll-token');

      controller.stopPoller();
    });

    it('keeps the user on the form with a submit error when the request fails', async () => {
      client.createAuthorizationRequest.and.rejectWith(new Error('rate limited'));
      const controller = build();

      await controller.handleSubmit('device', deviceFields);

      expect(setSubmitError).toHaveBeenCalledWith('rate limited');
      expect(setResultPanel).not.toHaveBeenCalledWith('device:waiting');
      expect(controller.poller).toBeNull();
    });

    it('runs the shared success path once when the device approves', async () => {
      client.createAuthorizationRequest.and.resolveTo(request);
      client.pollAuthorizationRequest.and.resolveTo({
        status: 'approved', user: { id: 1, username: 'foo', isAdmin: true }, refreshToken: 't',
      });
      const controller = build();

      await controller.handleSubmit('device', deviceFields);
      jasmine.clock().tick(5000);
      await flush();

      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, true);
      expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
      expect(globalThis.window.location.hash).toBe('/');
    });

    ['denied', 'expired', 'logged'].forEach((status) => {
      it(`shows the ${status} panel and stops the poller on ${status}`, async () => {
        client.createAuthorizationRequest.and.resolveTo(request);
        client.pollAuthorizationRequest.and.resolveTo({ status });
        const controller = build();

        await controller.handleSubmit('device', deviceFields);
        jasmine.clock().tick(5000);
        await flush();

        expect(setResultPanel).toHaveBeenCalledWith(`device:${status}`);
        expect(controller.poller).toBeNull();
      });
    });

    it('shows the notFound panel and stops the poller on a 404', async () => {
      client.createAuthorizationRequest.and.resolveTo(request);
      const error = new Error('not found');
      error.status = 404;
      client.pollAuthorizationRequest.and.rejectWith(error);
      const controller = build();

      await controller.handleSubmit('device', deviceFields);
      jasmine.clock().tick(5000);
      await flush();

      expect(setResultPanel).toHaveBeenCalledWith('device:notFound');
      expect(controller.poller).toBeNull();
    });
  });
});
