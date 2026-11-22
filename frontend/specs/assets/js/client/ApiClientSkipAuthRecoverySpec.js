import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';
import { stubRefreshFlow } from '../../../support/fetchSequence.js';

const unauthorized = {
  ok: false,
  status: 401,
  json: {
    error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' },
    statusCode: 401,
    timestamp: '2026-09-28T12:00:00.000Z',
  },
};

describe('ApiClient with skipAuthRecovery', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    installFakeWindow({ location: { hash: '' } });
    spyOn(LoginModalEvents, 'open');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    uninstallFakeWindow();
  });

  ['postJson', 'deleteJson', 'patchJson'].forEach((verb) => {
    describe(`.${verb}`, () => {
      let error;

      beforeEach(async () => {
        stubRefreshFlow([unauthorized]);

        try {
          await ApiClient[verb]('/auth/login.json', {}, { skipAuthRecovery: true });
        } catch (caught) {
          error = caught;
        }
      });

      it('rejects with the body code and message, not flagged sessionExpired', () => {
        expect(error instanceof ApiError).toBe(true);
        expect(error).toEqual(jasmine.objectContaining({
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
          sessionExpired: false,
        }));
      });

      it('makes exactly one request, with no refresh', () => {
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      });

      it('does not touch the session or open the login modal', () => {
        expect(AuthSession.get).not.toHaveBeenCalled();
        expect(AuthSession.set).not.toHaveBeenCalled();
        expect(AuthSession.clear).not.toHaveBeenCalled();
        expect(LoginModalEvents.open).not.toHaveBeenCalled();
      });
    });
  });
});
