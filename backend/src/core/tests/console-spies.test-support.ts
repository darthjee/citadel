/** The four `console` methods `LoggerService` may write to, each replaced by a silent spy. */
export type ConsoleSpies = {
  debug: jest.SpyInstance;
  info: jest.SpyInstance;
  warn: jest.SpyInstance;
  error: jest.SpyInstance;
};

/**
 * Replaces `console.debug/info/warn/error` with silent `jest.spyOn` spies so
 * a spec can assert on what `LoggerService` emitted without polluting the
 * test output. Call once at `describe` scope, not in `beforeAll`, so the
 * spies exist before any test-time logging happens.
 * @returns {ConsoleSpies} The spies, keyed by console method.
 */
export function createConsoleSpies(): ConsoleSpies {
  return {
    debug: jest.spyOn(console, 'debug').mockImplementation(() => undefined),
    info: jest.spyOn(console, 'info').mockImplementation(() => undefined),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    error: jest.spyOn(console, 'error').mockImplementation(() => undefined),
  };
}

/**
 * Clears the recorded calls of every spy, intended for `afterEach`.
 * @param {ConsoleSpies} spies - The spies returned by `createConsoleSpies()`.
 * @returns {void}
 */
export function clearConsoleSpies(spies: ConsoleSpies): void {
  Object.values(spies).forEach((spy) => spy.mockClear());
}

/**
 * Restores the original `console` methods, intended for `afterAll`.
 * @param {ConsoleSpies} spies - The spies returned by `createConsoleSpies()`.
 * @returns {void}
 */
export function restoreConsoleSpies(spies: ConsoleSpies): void {
  Object.values(spies).forEach((spy) => spy.mockRestore());
}
