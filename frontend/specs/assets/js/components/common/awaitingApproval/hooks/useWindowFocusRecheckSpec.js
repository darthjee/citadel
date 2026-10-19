import { buildWindowFocusEffect } from '../../../../../../../assets/js/components/common/awaitingApproval/hooks/useWindowFocusRecheck.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('useWindowFocusRecheck', () => {
  let fakeWindow;
  let recheck;

  beforeEach(() => {
    fakeWindow = installFakeWindow(new EventTarget());
    recheck = jasmine.createSpy('recheck');
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    uninstallFakeWindow();
  });

  describe('buildWindowFocusEffect', () => {
    it('re-checks when the window gains focus', () => {
      buildWindowFocusEffect(recheck)();

      fakeWindow.dispatchEvent(new Event('focus'));

      expect(recheck).toHaveBeenCalledTimes(1);
    });

    it('does not re-check on mount', () => {
      buildWindowFocusEffect(recheck)();

      expect(recheck).not.toHaveBeenCalled();
    });

    it('never re-checks on a timer', () => {
      buildWindowFocusEffect(recheck)();

      jasmine.clock().tick(10 * 60 * 1000);

      expect(recheck).not.toHaveBeenCalled();
    });

    it('unsubscribes on cleanup', () => {
      const cleanup = buildWindowFocusEffect(recheck)();

      cleanup();
      fakeWindow.dispatchEvent(new Event('focus'));

      expect(recheck).not.toHaveBeenCalled();
    });
  });
});
