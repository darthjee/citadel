import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import { USER_DENIED_MESSAGE } from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginErrorMessages.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('LoginModalController denied login', () => {
  let setSubmitError;
  let client;

  const passwordFields = { username: 'foo', password: 'secret' };
  const registerFields = {
    username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
  };

  const build = () => {
    const noop = jasmine.createSpy('noop');

    return new LoginModalController(noop, noop, noop, setSubmitError, noop, noop, client);
  };

  beforeEach(() => {
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', ['login', 'register', 'status']);
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'close');
    installFakeWindow({ location: { hash: '' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
    AuthSession.clear();
  });

  describe('when login answers 403 USER_DENIED', () => {
    beforeEach(() => {
      client.login.and.rejectWith(new ApiError(403, 'User denied', 'USER_DENIED'));
    });

    it('shows the denied-account message', async () => {
      await build().handleSubmit('password', passwordFields);

      expect(setSubmitError).toHaveBeenCalledWith(USER_DENIED_MESSAGE);
    });

    it('emits nothing and makes no status check', async () => {
      await build().handleSubmit('password', passwordFields);

      expect(AuthEvents.emit).not.toHaveBeenCalled();
      expect(client.status).not.toHaveBeenCalled();
    });

    it('keeps the modal open and does not redirect', async () => {
      await build().handleSubmit('password', passwordFields);

      expect(LoginModalEvents.close).not.toHaveBeenCalled();
      expect(globalThis.window.location.hash).toBe('');
    });
  });

  it('keeps the error message for a wrong password', async () => {
    client.login.and.rejectWith(new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS'));

    await build().handleSubmit('password', passwordFields);

    expect(setSubmitError).toHaveBeenCalledWith('Invalid credentials');
  });

  it('keeps the error message for other modes, even with a USER_DENIED code', async () => {
    client.register.and.rejectWith(new ApiError(403, 'backend wording', 'USER_DENIED'));

    await build().handleSubmit('register', registerFields);

    expect(setSubmitError).toHaveBeenCalledWith('backend wording');
  });
});
