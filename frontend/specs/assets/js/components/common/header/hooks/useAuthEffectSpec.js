import { buildAuthEffect } from '../../../../../../../assets/js/components/common/header/hooks/useAuthEffect.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('useAuthEffect', () => {
  let controller;
  let setLoggedIn;
  let setIsAdmin;
  let setters;

  beforeEach(() => {
    // Node-based Jasmine specs run without a DOM, so `window` is undefined there; a plain
    // `EventTarget` provides the same `addEventListener`/`removeEventListener`/`dispatchEvent`
    // shape AuthEvents relies on (matches AuthEventsSpec.js's setup).
    installFakeWindow(new EventTarget());
    controller = jasmine.createSpyObj('controller', ['checkStatus']);
    controller.checkStatus.and.resolveTo();
    setLoggedIn = jasmine.createSpy('setLoggedIn');
    setIsAdmin = jasmine.createSpy('setIsAdmin');
    setters = { setLoggedIn, setIsAdmin };
    spyOn(AuthEvents, 'subscribe').and.callThrough();
    spyOn(AuthEvents, 'unsubscribe').and.callThrough();
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('buildAuthEffect', () => {
    it('subscribes to AuthEvents on mount', () => {
      buildAuthEffect(controller, setters)();

      expect(AuthEvents.subscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it("triggers the controller's mount-time status check", () => {
      buildAuthEffect(controller, setters)();

      expect(controller.checkStatus).toHaveBeenCalled();
    });

    it('updates loggedIn and isAdmin state when AuthEvents emits a change', () => {
      buildAuthEffect(controller, setters)();

      AuthEvents.emit(true, true);

      expect(setLoggedIn).toHaveBeenCalledWith(true);
      expect(setIsAdmin).toHaveBeenCalledWith(true);
    });

    it('unsubscribes from AuthEvents on cleanup', () => {
      const cleanup = buildAuthEffect(controller, setters)();

      cleanup();

      expect(AuthEvents.unsubscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('does not update state once cleanup has run', () => {
      const cleanup = buildAuthEffect(controller, setters)();
      const handleAuthChanged = AuthEvents.subscribe.calls.mostRecent().args[0];

      cleanup();
      // Invoke the captured handler directly (bypassing AuthEvents.unsubscribe) to exercise the
      // `mounted` guard itself, independent of the real unsubscription already covered above —
      // guards against a status check resolving after the component has unmounted.
      handleAuthChanged({ detail: { loggedIn: true, isAdmin: true } });

      expect(setLoggedIn).not.toHaveBeenCalled();
      expect(setIsAdmin).not.toHaveBeenCalled();
    });
  });
});
