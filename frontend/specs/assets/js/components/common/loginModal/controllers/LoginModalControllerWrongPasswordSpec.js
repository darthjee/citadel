import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import { USER_DENIED_MESSAGE } from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginErrorMessages.js';
import AccountsClient from '../../../../../../../assets/js/client/AccountsClient.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { stubRefreshFlow } from '../../../../../../support/fetchSequence.js';

describe('LoginModalController wrong password through the real client', () => {
  let originalFetch;
  let setSubmitError;

  const passwordFields = { username: 'foo', password: 'wrong' };

  const loginFailure = (status, code, message) => ({
    ok: false,
    status,
    json: { error: { code, message }, statusCode: status, timestamp: '2026-09-28T12:00:00.000Z' },
  });

  const build = () => {
    const noop = jasmine.createSpy('noop');

    return new LoginModalController(noop, noop, noop, setSubmitError, noop, noop, AccountsClient);
  };

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    setSubmitError = jasmine.createSpy('setSubmitError');
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'open');
    spyOn(LoginModalEvents, 'close');
    installFakeWindow({ location: { hash: '' } });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    uninstallFakeWindow();
  });

  const expectUntouched = () => {
    expect(AuthSession.set).not.toHaveBeenCalled();
    expect(AuthSession.clear).not.toHaveBeenCalled();
    expect(LoginModalEvents.open).not.toHaveBeenCalled();
    expect(LoginModalEvents.close).not.toHaveBeenCalled();
    expect(AuthEvents.emit).not.toHaveBeenCalled();
  };

  it('shows the 401 message with no stored refresh token', async () => {
    stubRefreshFlow(
      [loginFailure(401, 'UNAUTHORIZED', 'Invalid username or password')],
      { refreshToken: null },
    );

    await build().handleSubmit('password', passwordFields);

    expect(setSubmitError).toHaveBeenCalledWith('Invalid username or password');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/auth/login.json');
    expectUntouched();
  });

  it('shows the 401 message and does not rotate a valid stored refresh token', async () => {
    stubRefreshFlow([loginFailure(401, 'UNAUTHORIZED', 'Invalid username or password')]);

    await build().handleSubmit('password', passwordFields);

    expect(setSubmitError).toHaveBeenCalledWith('Invalid username or password');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expectUntouched();
  });

  it('shows the denied-account message on a 403 USER_DENIED', async () => {
    stubRefreshFlow([loginFailure(403, 'USER_DENIED', 'User denied')], { refreshToken: null });

    await build().handleSubmit('password', passwordFields);

    expect(setSubmitError).toHaveBeenCalledWith(USER_DENIED_MESSAGE);
  });
});
