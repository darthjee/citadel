import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { flushMicrotasks as flush } from '../../../../../../support/flushMicrotasks.js';

describe('LoginModalController status re-check', () => {
  let setSubmitError;
  let client;

  const passwordFields = { username: 'foo', password: 'secret' };
  const registerFields = {
    username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
  };
  const loginResponse = { user: { id: 1, username: 'foo', isAdmin: true }, refreshToken: 'refresh-token' };

  const build = () => {
    const noop = jasmine.createSpy('noop');

    return new LoginModalController(noop, noop, noop, setSubmitError, noop, noop, client);
  };

  const persistingToken = () => async () => {
    AuthSession.set('refresh-token');
    return loginResponse;
  };

  beforeEach(() => {
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', [
      'login', 'register', 'status', 'createAuthorizationRequest', 'pollAuthorizationRequest',
    ]);
    client.login.and.callFake(persistingToken());
    client.register.and.callFake(persistingToken());
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'close');
    installFakeWindow({ location: { hash: '' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
    AuthSession.clear();
  });

  [
    ['password', passwordFields],
    ['register', registerFields],
  ].forEach(([mode, fields]) => {
    describe(`${mode} success`, () => {
      it('checks status.json with the stored token', async () => {
        client.status.and.resolveTo({ loggedIn: true, isAdmin: false });

        await build().handleSubmit(mode, fields);

        expect(client.status).toHaveBeenCalledWith('refresh-token');
      });

      it('emits logged in from the status answer, not from the response', async () => {
        client.status.and.resolveTo({ loggedIn: true, isAdmin: false });

        await build().handleSubmit(mode, fields);

        expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false, false);
        expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
        expect(globalThis.window.location.hash).toBe('/');
      });

      it('emits pending and keeps the token when the user awaits approval', async () => {
        client.status.and.resolveTo({ loggedIn: false, isAdmin: false, status: 'pending' });

        await build().handleSubmit(mode, fields);

        expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, true);
        expect(AuthSession.get()).toBe('refresh-token');
        expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
      });

      it('sets a submit error and keeps the modal open when the re-check fails', async () => {
        client.status.and.rejectWith(new Error('network down'));

        await build().handleSubmit(mode, fields);

        expect(setSubmitError).toHaveBeenCalledWith('network down');
        expect(AuthEvents.emit).not.toHaveBeenCalled();
        expect(LoginModalEvents.close).not.toHaveBeenCalled();
      });
    });
  });

  describe('approved-device success', () => {
    const request = { uuid: 'req-uuid', pollToken: 'poll-token', expiresAt: '2999-01-01T00:00:00.000Z' };

    beforeEach(() => {
      jasmine.clock().install();
      client.createAuthorizationRequest.and.resolveTo(request);
      client.pollAuthorizationRequest.and.callFake(async () => {
        AuthSession.set('refresh-token');
        return { status: 'approved', ...loginResponse };
      });
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    const approve = async () => {
      await build().handleSubmit('device', { username: 'foo' });
      jasmine.clock().tick(5000);
      await flush();
      await flush();
    };

    it('emits from the status answer', async () => {
      client.status.and.resolveTo({ loggedIn: true, isAdmin: true });

      await approve();

      expect(client.status).toHaveBeenCalledWith('refresh-token');
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, true, false);
      expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
    });

    it('sets a submit error when the re-check fails', async () => {
      client.status.and.rejectWith(new Error('network down'));

      await approve();

      expect(setSubmitError).toHaveBeenCalledWith('network down');
      expect(LoginModalEvents.close).not.toHaveBeenCalled();
    });
  });
});
