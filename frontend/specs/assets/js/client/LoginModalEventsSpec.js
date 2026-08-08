import LoginModalEvents from '../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';

describe('LoginModalEvents', () => {

  beforeEach(() => {
    // Node-based Jasmine specs run without a DOM, so `window` is undefined there; a plain
    // `EventTarget` provides the same `addEventListener`/`removeEventListener`/`dispatchEvent`
    // shape LoginModalEvents relies on.
    installFakeWindow(new EventTarget());
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('.open', () => {
    it('dispatches a window event carrying open: true and the given mode', () => {
      const handler = jasmine.createSpy('handler');

      LoginModalEvents.subscribe(handler);

      try {
        LoginModalEvents.open('password');

        expect(handler).toHaveBeenCalled();
        expect(handler.calls.mostRecent().args[0].type).toBe('login-modal:toggle');
        expect(handler.calls.mostRecent().args[0].detail).toEqual({ open: true, mode: 'password' });
      } finally {
        LoginModalEvents.unsubscribe(handler);
      }
    });

    it('merges optional extra detail into the payload', () => {
      const handler = jasmine.createSpy('handler');

      LoginModalEvents.subscribe(handler);

      try {
        LoginModalEvents.open('register', { reason: 'session-expired' });

        expect(handler.calls.mostRecent().args[0].detail).toEqual({
          open: true,
          mode: 'register',
          reason: 'session-expired',
        });
      } finally {
        LoginModalEvents.unsubscribe(handler);
      }
    });
  });

  describe('.close', () => {
    it('dispatches a window event carrying open: false', () => {
      const handler = jasmine.createSpy('handler');

      LoginModalEvents.subscribe(handler);

      try {
        LoginModalEvents.close();

        expect(handler).toHaveBeenCalled();
        expect(handler.calls.mostRecent().args[0].type).toBe('login-modal:toggle');
        expect(handler.calls.mostRecent().args[0].detail).toEqual({ open: false });
      } finally {
        LoginModalEvents.unsubscribe(handler);
      }
    });
  });

  describe('.subscribe / .unsubscribe', () => {
    it('stops the handler from firing on a subsequent open after unsubscribing', () => {
      const handler = jasmine.createSpy('handler');

      LoginModalEvents.subscribe(handler);
      LoginModalEvents.unsubscribe(handler);
      LoginModalEvents.open('password');

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
