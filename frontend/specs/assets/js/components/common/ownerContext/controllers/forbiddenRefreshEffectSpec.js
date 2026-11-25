import buildForbiddenRefreshEffect from '../../../../../../../assets/js/components/common/ownerContext/controllers/forbiddenRefreshEffect.js';
import PermissionEvents from '../../../../../../../assets/js/client/PermissionEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('buildForbiddenRefreshEffect', () => {
  let resolveRefresh;
  let refresh;

  beforeEach(() => {
    installFakeWindow(new EventTarget());
    refresh = jasmine.createSpy('refresh').and.callFake(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('refreshes on a 403', () => {
    const cleanup = buildForbiddenRefreshEffect(refresh)();

    PermissionEvents.emitForbidden();

    expect(refresh).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('refreshes once for a burst of 403s', () => {
    const cleanup = buildForbiddenRefreshEffect(refresh)();

    PermissionEvents.emitForbidden();
    PermissionEvents.emitForbidden();
    PermissionEvents.emitForbidden();

    expect(refresh).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('refreshes again for a 403 after the previous refresh completed', async () => {
    const cleanup = buildForbiddenRefreshEffect(refresh)();

    PermissionEvents.emitForbidden();
    resolveRefresh();
    await Promise.resolve();
    await Promise.resolve();
    PermissionEvents.emitForbidden();

    expect(refresh).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('refreshes again after a failed refresh', async () => {
    refresh.and.returnValues(Promise.reject(new Error('boom')), Promise.resolve());
    const events = { onForbidden: jasmine.createSpy('onForbidden').and.returnValue(() => undefined) };

    buildForbiddenRefreshEffect(refresh, events)();

    const handler = events.onForbidden.calls.mostRecent().args[0];

    await expectAsync(handler()).toBeRejectedWithError('boom');
    await handler();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('stops refreshing once cleaned up', () => {
    const cleanup = buildForbiddenRefreshEffect(refresh)();

    cleanup();
    PermissionEvents.emitForbidden();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns the bus unsubscribe as cleanup', () => {
    const unsubscribe = jasmine.createSpy('unsubscribe');
    const events = { onForbidden: jasmine.createSpy('onForbidden').and.returnValue(unsubscribe) };

    expect(buildForbiddenRefreshEffect(refresh, events)()).toBe(unsubscribe);
  });
});
