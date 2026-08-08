import AuthSession from '../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../assets/js/client/LoginModalEvents.js';

/**
 * Build a fake `fetch` `Response`-like object whose `json`/`text` behave like a real one: an
 * empty body cannot be parsed as JSON (`json()` rejects, mirroring `SyntaxError: Unexpected
 * end of JSON input`), while a non-empty body is serialized/parsed for real.
 *
 * @param {{ok: boolean, status: number, json: object|undefined}} descriptor - Response shape;
 *   `json` is omitted (or `undefined`) to simulate a truly empty body, e.g. a `204`.
 * @returns {{ok: boolean, status: number, json: Function, text: Function}} The fake response.
 */
export function fakeResponse({ json, ...rest }) {
  const body = json === undefined ? '' : JSON.stringify(json);

  return {
    ...rest,
    text: () => Promise.resolve(body),
    json: () => (body === '' ? Promise.reject(new SyntaxError('Unexpected end of JSON input')) : Promise.resolve(JSON.parse(body))),
  };
}

/**
 * Build a `fetch` spy that resolves with the given responses in order, one per call.
 *
 * @param {Array<{ok: boolean, status: number, json: object}>} responses - Ordered responses.
 * @returns {jasmine.Spy} The `fetch` spy.
 */
export function fetchSequence(responses) {
  let call = 0;

  return jasmine.createSpy('fetch').and.callFake(() => {
    const response = fakeResponse(responses.at(call));
    call += 1;
    return Promise.resolve(response);
  });
}

/**
 * Stubs the token-refresh flow: spies on `AuthSession` and replaces `globalThis.fetch`.
 *
 * @description Spies `AuthSession.get` (returning the given refresh token), `AuthSession.set`
 * and `AuthSession.clear`, and assigns `globalThis.fetch` a `fetchSequence` of the responses.
 * The caller is responsible for restoring `globalThis.fetch` (e.g. in an `afterEach`).
 * @param {Array<{ok: boolean, status: number, json: object}>} responses - Ordered responses.
 * @param {{refreshToken: (string|null)}} [options] - Stub options; `refreshToken` is the token
 *   `AuthSession.get` returns (defaults to `'old-refresh-token'`, pass `null` for none).
 * @returns {void}
 */
export function stubRefreshFlow(responses, { refreshToken = 'old-refresh-token' } = {}) {
  spyOn(AuthSession, 'get').and.returnValue(refreshToken);
  spyOn(AuthSession, 'set');
  spyOn(AuthSession, 'clear');
  globalThis.fetch = fetchSequence(responses);
}

/**
 * Asserts that the session was treated as expired.
 *
 * @description Expects `AuthSession.clear` to have been called, `LoginModalEvents.open` to have
 * been called with `'password'` and the window hash to be empty. Requires `AuthSession.clear`
 * and `LoginModalEvents.open` to be spied on, and a fake `window` to be installed.
 * @returns {void}
 */
export function expectSessionExpired() {
  expect(AuthSession.clear).toHaveBeenCalled();
  expect(LoginModalEvents.open).toHaveBeenCalledWith('password');
  expect(globalThis.window.location.hash).toBe('');
}
