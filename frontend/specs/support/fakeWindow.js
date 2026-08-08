let installed = false;
let hadWindow = false;
let previousWindow;

/**
 * Installs a fake as `globalThis.window`, remembering the original value.
 *
 * @description Node-based Jasmine specs run without a DOM, so `window` is normally undefined.
 * The original state is recorded on the first install since the last uninstall; later calls
 * only swap in the new fake. Pair with `uninstallFakeWindow()` in an `afterEach`.
 * @param {object} fake - The fake window (a plain object or an `EventTarget`).
 * @returns {object} The same fake, so callers can assert on it.
 */
export const installFakeWindow = (fake) => {
  if (!installed) {
    installed = true;
    hadWindow = 'window' in globalThis;
    previousWindow = globalThis.window;
  }
  globalThis.window = fake;
  return fake;
};

/**
 * Restores `globalThis.window` to its state before the first `installFakeWindow()` call.
 *
 * @description Restores the previous value, or deletes `window` when there was none. A no-op
 * when nothing was installed, so it is safe in a top-level `afterEach`.
 * @returns {void}
 */
export const uninstallFakeWindow = () => {
  if (!installed) {
    return;
  }
  if (hadWindow) {
    globalThis.window = previousWindow;
  } else {
    delete globalThis.window;
  }
  installed = false;
  hadWindow = false;
  previousWindow = undefined;
};
