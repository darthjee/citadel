import AppController from '../../../../assets/js/components/AppController.js';

describe('AppController', () => {
  it('resolves the current route from the hash', () => {
    const controller = new AppController(() => undefined, null, () => '#/recover-password');

    expect(controller.getRoute()).toEqual({ page: 'reset-password', context: { kind: 'personal' } });
  });

  it('resolves a malformed organization hash to not-found in the Personal context', () => {
    const controller = new AppController(() => undefined, null, () => '#/orgs/007');

    expect(controller.getRoute()).toEqual({ page: 'not-found', context: { kind: 'personal' } });
  });

  it('subscribes to hashchange when an event target is given', () => {
    const eventTarget = jasmine.createSpyObj('eventTarget', ['addEventListener', 'removeEventListener']);
    const controller = new AppController(() => undefined, eventTarget, () => '#/');

    controller.buildEffect()();

    expect(eventTarget.addEventListener).toHaveBeenCalledWith('hashchange', jasmine.any(Function));
  });

  it('updates the route when the hash changes', () => {
    const setRoute = jasmine.createSpy('setRoute');
    const eventTarget = jasmine.createSpyObj('eventTarget', ['addEventListener', 'removeEventListener']);
    let hash = '#/';
    const controller = new AppController(setRoute, eventTarget, () => hash);

    controller.buildEffect()();
    const handler = eventTarget.addEventListener.calls.mostRecent().args[1];
    hash = '#/recover-password';
    handler();

    expect(setRoute).toHaveBeenCalledWith({ page: 'reset-password', context: { kind: 'personal' } });
  });

  it('unsubscribes on cleanup', () => {
    const eventTarget = jasmine.createSpyObj('eventTarget', ['addEventListener', 'removeEventListener']);
    const controller = new AppController(() => undefined, eventTarget, () => '#/');

    const cleanup = controller.buildEffect()();
    cleanup();

    expect(eventTarget.removeEventListener).toHaveBeenCalledWith('hashchange', jasmine.any(Function));
  });

  it('does nothing when no event target is available', () => {
    const controller = new AppController(() => undefined, null, () => '#/');

    expect(controller.buildEffect()()).toBeUndefined();
  });
});
