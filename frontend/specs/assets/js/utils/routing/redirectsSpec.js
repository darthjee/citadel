import {
  redirectHome,
  redirectIfForbidden,
} from '../../../../../assets/js/utils/routing/redirects.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../support/fakeWindow.js';

describe('redirects', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('redirectHome', () => {
    it('sets the hash to "/" when a window exists', () => {
      const fake = installFakeWindow({ location: { hash: '#/other' } });

      redirectHome();

      expect(fake.location.hash).toBe('/');
    });

    it('does nothing when window is undefined', () => {
      expect(() => redirectHome()).not.toThrow();
    });
  });

  describe('redirectIfForbidden', () => {
    it('returns false and leaves the hash untouched for a non-403 error', () => {
      const fake = installFakeWindow({ location: { hash: '#/other' } });

      const result = redirectIfForbidden({ status: 500 });

      expect(result).toBe(false);
      expect(fake.location.hash).toBe('#/other');
    });

    it('returns true and sets the hash to "/" for a 403 error', () => {
      const fake = installFakeWindow({ location: { hash: '#/other' } });

      const result = redirectIfForbidden({ status: 403 });

      expect(result).toBe(true);
      expect(fake.location.hash).toBe('/');
    });
  });
});
