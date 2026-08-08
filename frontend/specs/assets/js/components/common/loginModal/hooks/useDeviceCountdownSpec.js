import { buildDeviceCountdownEffect } from '../../../../../../../assets/js/components/common/loginModal/hooks/useDeviceCountdown.js';

describe('useDeviceCountdown', () => {
  describe('buildDeviceCountdownEffect', () => {
    let setNow;

    beforeEach(() => {
      jasmine.clock().install();
      setNow = jasmine.createSpy('setNow');
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('does nothing and returns no cleanup when the waiting panel is not shown', () => {
      const cleanup = buildDeviceCountdownEffect('device:denied', setNow)();

      jasmine.clock().tick(5000);

      expect(cleanup).toBeUndefined();
      expect(setNow).not.toHaveBeenCalled();
    });

    it('does nothing when there is no result panel', () => {
      const cleanup = buildDeviceCountdownEffect(null, setNow)();

      jasmine.clock().tick(5000);

      expect(cleanup).toBeUndefined();
      expect(setNow).not.toHaveBeenCalled();
    });

    it('bumps now once a second while the device:waiting panel is shown', () => {
      buildDeviceCountdownEffect('device:waiting', setNow)();

      jasmine.clock().tick(3000);

      expect(setNow).toHaveBeenCalledTimes(3);
      expect(setNow).toHaveBeenCalledWith(jasmine.any(Number));
    });

    it('stops ticking after its cleanup runs', () => {
      const cleanup = buildDeviceCountdownEffect('device:waiting', setNow)();

      jasmine.clock().tick(1000);
      cleanup();
      jasmine.clock().tick(5000);

      expect(setNow).toHaveBeenCalledTimes(1);
    });
  });
});
