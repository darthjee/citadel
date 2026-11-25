import PermissionEvents from '../../../../assets/js/client/PermissionEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';

describe('PermissionEvents', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('with a window', () => {
    beforeEach(() => {
      installFakeWindow(new EventTarget());
    });

    it('notifies a subscriber with a permission:forbidden event', () => {
      const listener = jasmine.createSpy('listener');
      const unsubscribe = PermissionEvents.onForbidden(listener);

      try {
        PermissionEvents.emitForbidden();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.calls.mostRecent().args[0].type).toBe('permission:forbidden');
      } finally {
        unsubscribe();
      }
    });

    it('notifies every subscriber', () => {
      const first = jasmine.createSpy('first');
      const second = jasmine.createSpy('second');
      const unsubscribers = [PermissionEvents.onForbidden(first), PermissionEvents.onForbidden(second)];

      try {
        PermissionEvents.emitForbidden();

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
      } finally {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      }
    });

    it('stops notifying after unsubscribing', () => {
      const listener = jasmine.createSpy('listener');
      const unsubscribe = PermissionEvents.onForbidden(listener);

      unsubscribe();
      PermissionEvents.emitForbidden();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('without a window', () => {
    it('emits nothing and does not throw', () => {
      installFakeWindow(undefined);
      delete globalThis.window;

      expect(() => PermissionEvents.emitForbidden()).not.toThrow();
    });

    it('does not throw with a window lacking dispatchEvent', () => {
      installFakeWindow({ location: { hash: '' } });

      expect(() => PermissionEvents.emitForbidden()).not.toThrow();
    });
  });
});
