import { installFakeWindow, uninstallFakeWindow } from './fakeWindow.js';

describe('fakeWindow', () => {
  afterEach(() => {
    uninstallFakeWindow();
    delete globalThis.window;
  });

  describe('installFakeWindow', () => {
    it('installs the fake as globalThis.window', () => {
      const fake = { location: { hash: '#/x' } };

      installFakeWindow(fake);

      expect(globalThis.window).toBe(fake);
    });

    it('returns the installed fake', () => {
      const fake = {};

      expect(installFakeWindow(fake)).toBe(fake);
    });

    it('keeps the true original when installed a second time', () => {
      const original = { original: true };
      globalThis.window = original;

      installFakeWindow({ first: true });
      installFakeWindow({ second: true });
      uninstallFakeWindow();

      expect(globalThis.window).toBe(original);
    });
  });

  describe('uninstallFakeWindow', () => {
    it('deletes window when none existed before', () => {
      installFakeWindow({});

      uninstallFakeWindow();

      expect('window' in globalThis).toBe(false);
    });

    it('restores a pre-existing window', () => {
      const original = { original: true };
      globalThis.window = original;
      installFakeWindow({});

      uninstallFakeWindow();

      expect(globalThis.window).toBe(original);
    });

    it('is a no-op when nothing was installed', () => {
      const original = { original: true };
      globalThis.window = original;

      uninstallFakeWindow();

      expect(globalThis.window).toBe(original);
    });

    it('is safe to call twice', () => {
      installFakeWindow({});
      uninstallFakeWindow();

      expect(() => uninstallFakeWindow()).not.toThrow();
      expect('window' in globalThis).toBe(false);
    });
  });
});
