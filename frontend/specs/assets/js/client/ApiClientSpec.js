import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../../../assets/js/client/LoginModalEvents.js';
import PermissionEvents from '../../../../assets/js/client/PermissionEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';
import {
  expectSessionExpired, expectSessionExpiredRejection, fetchSequence, stubRefreshFlow,
} from '../../../support/fetchSequence.js';

function errorBody(statusCode, code, message, details) {
  return { error: { code, message, details }, statusCode, timestamp: '2026-09-28T12:00:00.000Z' };
}

describe('ApiClient', () => {
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

  describe('.postJson', () => {
    it('posts a JSON body with same-origin credentials', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { id: 1 } }]);

      await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(globalThis.fetch).toHaveBeenCalledWith('/accounts/register.json', jasmine.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ username: 'foo' }),
      }));
    });

    it('resolves with the parsed JSON body on success', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { id: 1, username: 'foo' } }]);

      const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(data).toEqual({ id: 1, username: 'foo' });
    });

    it('throws an ApiError with the status, message and code on a non-401 failure', async () => {
      globalThis.fetch = fetchSequence([{
        ok: false, status: 409, json: errorBody(409, 'USERNAME_TAKEN', 'username is not available'),
      }]);

      await expectAsync(ApiClient.postJson('/accounts/register.json', {}))
        .toBeRejectedWith(jasmine.objectContaining(
          { status: 409, message: 'username is not available', code: 'USERNAME_TAKEN', details: undefined },
        ));
    });

    it('carries the validation details onto the ApiError', async () => {
      const details = ['username must be a string', 'email must be an email'];

      globalThis.fetch = fetchSequence([{
        ok: false, status: 400, json: errorBody(400, 'VALIDATION_FAILED', details.join('; '), details),
      }]);

      await expectAsync(ApiClient.postJson('/accounts/register.json', {}))
        .toBeRejectedWith(jasmine.objectContaining(
          { status: 400, message: details.join('; '), code: 'VALIDATION_FAILED', details },
        ));
    });

    it('falls back to the status text when the error body is empty', async () => {
      globalThis.fetch = fetchSequence([{ ok: false, status: 502, statusText: 'Bad Gateway' }]);

      await expectAsync(ApiClient.postJson('/accounts/register.json', {}))
        .toBeRejectedWith(jasmine.objectContaining(
          { status: 502, message: 'Bad Gateway', code: undefined, details: undefined },
        ));
    });

    it('falls back to the status text when the error body is not JSON', async () => {
      globalThis.fetch = jasmine.createSpy('fetch').and.returnValue(Promise.resolve({
        ok: false, status: 502, statusText: 'Bad Gateway', text: () => Promise.resolve('<html>Bad Gateway</html>'),
      }));

      await expectAsync(ApiClient.postJson('/accounts/register.json', {}))
        .toBeRejectedWith(jasmine.objectContaining({ status: 502, message: 'Bad Gateway' }));
    });

    it('falls back to a generic message when there is neither an error message nor a status text', async () => {
      globalThis.fetch = fetchSequence([{ ok: false, status: 500, json: { statusCode: 500 } }]);

      await expectAsync(ApiClient.postJson('/accounts/register.json', {}))
        .toBeRejectedWith(jasmine.objectContaining({ status: 500, message: 'Request failed' }));
    });

    it('throws instances of ApiError', async () => {
      globalThis.fetch = fetchSequence([{ ok: false, status: 400, json: errorBody(400, 'BAD_REQUEST', 'bad request') }]);

      try {
        await ApiClient.postJson('/accounts/register.json', {});
        fail('expected postJson to throw');
      } catch (error) {
        expect(error instanceof ApiError).toBe(true);
      }
    });
  });

  describe('.deleteJson', () => {
    it('deletes a JSON body with same-origin credentials', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 204 }]);

      await ApiClient.deleteJson('/auth/logoff.json', { refreshToken: 'token' });

      expect(globalThis.fetch).toHaveBeenCalledWith('/auth/logoff.json', jasmine.objectContaining({
        method: 'DELETE',
        credentials: 'same-origin',
        body: JSON.stringify({ refreshToken: 'token' }),
      }));
    });

    it('resolves without throwing on a 204 response with a truly empty body, the way a ' +
      'real `fetch` behaves for DELETE /auth/logoff.json', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 204 }]);

      const data = await ApiClient.deleteJson('/auth/logoff.json', { refreshToken: 'token' });

      expect(data).toEqual({});
    });
  });

  describe('.patchJson', () => {
    it('patches a JSON body with same-origin credentials', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { username: 'foo' } }]);

      await ApiClient.patchJson('/auth/account.json', { currentPassword: 'secret' });

      expect(globalThis.fetch).toHaveBeenCalledWith('/auth/account.json', jasmine.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword: 'secret' }),
      }));
    });

    it('resolves with the parsed JSON body on success', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { username: 'foo', email: 'foo@example.com' } }]);

      const data = await ApiClient.patchJson('/auth/account.json', { currentPassword: 'secret' });

      expect(data).toEqual({ username: 'foo', email: 'foo@example.com' });
    });

    it('throws an ApiError with the status and message on a non-401 failure', async () => {
      globalThis.fetch = fetchSequence([{
        ok: false, status: 400, json: errorBody(400, 'BAD_REQUEST', 'Invalid current password'),
      }]);

      await expectAsync(ApiClient.patchJson('/auth/account.json', { currentPassword: 'wrong' }))
        .toBeRejectedWith(jasmine.objectContaining(
          { status: 400, message: 'Invalid current password' },
        ));
    });
  });

  describe('.getJson', () => {
    it('sends a GET with same-origin credentials and no body option', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: [] }]);

      await ApiClient.getJson('/orgs.json');

      const [path, options] = globalThis.fetch.calls.argsFor(0);

      expect(path).toBe('/orgs.json');
      expect(options).toEqual(jasmine.objectContaining({ method: 'GET', credentials: 'same-origin' }));
      expect('body' in options).toBeFalse();
    });

    it('resolves with the parsed JSON body on success', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: [{ id: 5 }] }]);

      expect(await ApiClient.getJson('/orgs.json')).toEqual([{ id: 5 }]);
    });

    it('rejects a 401 as a plain ApiError with skipAuthRecovery', async () => {
      stubRefreshFlow([{ ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', 'Unauthorized') }]);

      await expectAsync(ApiClient.getJson('/orgs.json', { skipAuthRecovery: true }))
        .toBeRejectedWith(jasmine.objectContaining({ status: 401, sessionExpired: false }));
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('403 handling', () => {
    it('emits permission:forbidden before rejecting', async () => {
      const order = [];

      spyOn(PermissionEvents, 'emitForbidden').and.callFake(() => order.push('emit'));
      globalThis.fetch = fetchSequence([{ ok: false, status: 403, json: errorBody(403, 'FORBIDDEN', 'Forbidden') }]);

      await ApiClient.patchJson('/orgs/5.json', { name: 'x' }).catch((error) => order.push(error.status));

      expect(order).toEqual(['emit', 403]);
    });

    it('does not emit permission:forbidden on other failures', async () => {
      spyOn(PermissionEvents, 'emitForbidden');
      globalThis.fetch = fetchSequence([{ ok: false, status: 404, json: errorBody(404, 'NOT_FOUND', 'Not Found') }]);

      await expectAsync(ApiClient.getJson('/orgs/5.json')).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
      expect(PermissionEvents.emitForbidden).not.toHaveBeenCalled();
    });

    it('does not emit permission:forbidden on success', async () => {
      spyOn(PermissionEvents, 'emitForbidden');
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: {} }]);

      await ApiClient.getJson('/orgs/5.json');

      expect(PermissionEvents.emitForbidden).not.toHaveBeenCalled();
    });
  });

  describe('401 handling', () => {
    it('refreshes the access token and retries the original request on success', async () => {
      stubRefreshFlow([
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', 'Unauthorized') },
        { ok: true, status: 200, json: { user: { id: 1 }, refreshToken: 'new-refresh-token' } },
        { ok: true, status: 200, json: { id: 1, username: 'foo' } },
      ]);

      const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(data).toEqual({ id: 1, username: 'foo' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      expect(globalThis.fetch.calls.argsFor(1)[0]).toBe('/auth/refresh.json');
      expect(AuthSession.set).toHaveBeenCalledWith('new-refresh-token');
      expect(AuthSession.clear).not.toHaveBeenCalled();
      expect(globalThis.window.location.hash).toBe('');
      expect(LoginModalEvents.open).not.toHaveBeenCalled();
    });

    it('treats a failed refresh as a session expiry: clears the session and opens the login modal', async () => {
      stubRefreshFlow([
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', 'Unauthorized') },
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', 'invalid refresh token') },
      ]);

      await expectSessionExpiredRejection(ApiClient.postJson('/accounts/register.json', { username: 'foo' }));

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expectSessionExpired();
    });

    it('treats a missing refresh token as a session expiry, without attempting a refresh call', async () => {
      stubRefreshFlow([
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', 'Unauthorized') },
      ], { refreshToken: null });

      await expectSessionExpiredRejection(ApiClient.postJson('/accounts/register.json', { username: 'foo' }));

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expectSessionExpired();
    });

    it('does not attempt a second refresh when the retried request also returns 401', async () => {
      stubRefreshFlow([
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', 'Unauthorized') },
        { ok: true, status: 200, json: { user: { id: 1 }, refreshToken: 'new-refresh-token' } },
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', 'Unauthorized') },
      ]);

      await expectSessionExpiredRejection(ApiClient.postJson('/accounts/register.json', { username: 'foo' }));

      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      expectSessionExpired();
    });
  });
});
