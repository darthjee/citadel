import AuthEvents from '../../../../assets/js/client/AuthEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';

describe('AuthEvents', () => {

  beforeEach(() => {
    // Node-based Jasmine specs run without a DOM, so `window` is undefined there; a plain
    // `EventTarget` provides the same `addEventListener`/`removeEventListener`/`dispatchEvent`
    // shape AuthEvents relies on.
    installFakeWindow(new EventTarget());
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('.emit', () => {
    it('dispatches a window event carrying loggedIn: true and the given isAdmin value', () => {
      const handler = jasmine.createSpy('handler');

      AuthEvents.subscribe(handler);

      try {
        AuthEvents.emit(true, true);

        expect(handler).toHaveBeenCalled();
        expect(handler.calls.mostRecent().args[0].type).toBe('auth:changed');
        expect(handler.calls.mostRecent().args[0].detail).toEqual({ loggedIn: true, isAdmin: true });
      } finally {
        AuthEvents.unsubscribe(handler);
      }
    });

    it('dispatches a window event carrying loggedIn: false', () => {
      const handler = jasmine.createSpy('handler');

      AuthEvents.subscribe(handler);

      try {
        AuthEvents.emit(false);

        expect(handler).toHaveBeenCalled();
        expect(handler.calls.mostRecent().args[0].detail).toEqual({ loggedIn: false, isAdmin: false });
      } finally {
        AuthEvents.unsubscribe(handler);
      }
    });

    it('defaults isAdmin to false when omitted', () => {
      const handler = jasmine.createSpy('handler');

      AuthEvents.subscribe(handler);

      try {
        AuthEvents.emit(true);

        expect(handler.calls.mostRecent().args[0].detail).toEqual({ loggedIn: true, isAdmin: false });
      } finally {
        AuthEvents.unsubscribe(handler);
      }
    });
  });

  describe('.subscribe / .unsubscribe', () => {
    it('stops the handler from firing on a subsequent emit after unsubscribing', () => {
      const handler = jasmine.createSpy('handler');

      AuthEvents.subscribe(handler);
      AuthEvents.unsubscribe(handler);
      AuthEvents.emit(true);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
