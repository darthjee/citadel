import { buildLoginModalEffect } from '../../../../../../../assets/js/components/common/loginModal/hooks/useLoginModal.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('useLoginModal', () => {
  let controller;
  let setOpen;
  let setResetToken;
  let setResultPanel;
  let setters;

  beforeEach(() => {
    // Node-based Jasmine specs run without a DOM, so `window` is undefined there; a plain
    // `EventTarget` provides the same event-target shape LoginModalEvents relies on.
    installFakeWindow(new EventTarget());
    controller = jasmine.createSpyObj('controller', ['switchMode', 'stopPoller']);
    setOpen = jasmine.createSpy('setOpen');
    setResetToken = jasmine.createSpy('setResetToken');
    setResultPanel = jasmine.createSpy('setResultPanel');
    setters = { setOpen, setResetToken, setResultPanel };
    spyOn(LoginModalEvents, 'subscribe').and.callThrough();
    spyOn(LoginModalEvents, 'unsubscribe').and.callThrough();
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('buildLoginModalEffect', () => {
    it('subscribes to LoginModalEvents on mount', () => {
      buildLoginModalEffect(controller, setters)();

      expect(LoginModalEvents.subscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('opens the modal and switches to the requested mode on an open event', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.open('register');

      expect(setOpen).toHaveBeenCalledWith(true);
      expect(controller.switchMode).toHaveBeenCalledWith('register');
    });

    it('stores the reset token and clears the result panel on an open event with a token', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.open('resetPassword', { token: 'abc' });

      expect(setResetToken).toHaveBeenCalledWith('abc');
      expect(setResultPanel).toHaveBeenCalledWith(null);
      expect(controller.switchMode).toHaveBeenCalledWith('resetPassword');
    });

    it('stores an empty reset token on an open event without a token', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.open('recover');

      expect(setResetToken).toHaveBeenCalledWith('');
    });

    it('closes the modal without switching mode on a close event', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.close();

      expect(setOpen).toHaveBeenCalledWith(false);
      expect(controller.switchMode).not.toHaveBeenCalled();
      expect(setResetToken).not.toHaveBeenCalled();
    });

    it('tears down any running poller on a close event', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.close();

      expect(controller.stopPoller).toHaveBeenCalledTimes(1);
    });

    it('does not tear down the poller on an open event', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.open('device');

      expect(controller.stopPoller).not.toHaveBeenCalled();
    });

    it('unsubscribes from LoginModalEvents on cleanup', () => {
      const cleanup = buildLoginModalEffect(controller, setters)();

      cleanup();

      expect(LoginModalEvents.unsubscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('tears down any running poller on cleanup', () => {
      const cleanup = buildLoginModalEffect(controller, setters)();

      cleanup();

      expect(controller.stopPoller).toHaveBeenCalledTimes(1);
    });

    it('does not update state once cleanup has run', () => {
      const cleanup = buildLoginModalEffect(controller, setters)();
      const handleToggle = LoginModalEvents.subscribe.calls.mostRecent().args[0];

      cleanup();
      // Invoke the captured handler directly to exercise the `mounted` guard itself,
      // independent of the real unsubscription already covered above.
      handleToggle({ detail: { open: true, mode: 'register' } });

      expect(setOpen).not.toHaveBeenCalled();
      expect(controller.switchMode).not.toHaveBeenCalled();
    });
  });
});
