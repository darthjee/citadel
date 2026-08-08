import AuthSession from '../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from './fakeWindow.js';
import {
  expectSessionExpired, fakeResponse, fetchSequence, stubRefreshFlow,
} from './fetchSequence.js';

describe('fetchSequence support', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fakeResponse', () => {
    it('parses a non-empty body as JSON', async () => {
      const response = fakeResponse({ ok: true, status: 200, json: { id: 1 } });

      expect(await response.json()).toEqual({ id: 1 });
    });

    it('exposes the body as text', async () => {
      const response = fakeResponse({ ok: true, status: 200, json: { id: 1 } });

      expect(await response.text()).toBe('{"id":1}');
    });

    it('rejects json() for an empty body', async () => {
      const response = fakeResponse({ ok: true, status: 204 });

      await expectAsync(response.json()).toBeRejectedWithError(SyntaxError);
    });

    it('keeps the ok and status fields', () => {
      const response = fakeResponse({ ok: false, status: 401 });

      expect(response).toEqual(jasmine.objectContaining({ ok: false, status: 401 }));
    });
  });

  describe('fetchSequence', () => {
    it('resolves with the responses in order, one per call', async () => {
      const fetch = fetchSequence([
        { ok: true, status: 200, json: { n: 1 } },
        { ok: true, status: 200, json: { n: 2 } },
      ]);

      const first = await (await fetch()).json();
      const second = await (await fetch()).json();

      expect([first, second]).toEqual([{ n: 1 }, { n: 2 }]);
    });
  });

  describe('stubRefreshFlow', () => {
    it('defaults the refresh token to old-refresh-token', () => {
      stubRefreshFlow([]);

      expect(AuthSession.get()).toBe('old-refresh-token');
    });

    it('returns the given refresh token, including null', () => {
      stubRefreshFlow([], { refreshToken: null });

      expect(AuthSession.get()).toBeNull();
    });

    it('spies on AuthSession.set and AuthSession.clear', () => {
      stubRefreshFlow([]);

      AuthSession.set('token');
      AuthSession.clear();

      expect(AuthSession.set).toHaveBeenCalledWith('token');
      expect(AuthSession.clear).toHaveBeenCalled();
    });

    it('installs a fetch that serves the given responses', async () => {
      stubRefreshFlow([{ ok: true, status: 200, json: { id: 1 } }]);

      const response = await globalThis.fetch('/anything');

      expect(await response.json()).toEqual({ id: 1 });
    });
  });

  describe('expectSessionExpired', () => {
    beforeEach(() => {
      installFakeWindow({ location: { hash: '' } });
      spyOn(AuthSession, 'clear');
      spyOn(LoginModalEvents, 'open');
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    it('passes when the session was cleared and the password modal opened', () => {
      AuthSession.clear();
      LoginModalEvents.open('password');

      expectSessionExpired();
    });
  });
});
