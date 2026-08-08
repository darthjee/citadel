import AppController from '../../../../assets/js/components/AppController.js';

describe('AppController', () => {
  it('resolves the current page from the hash', () => {
    const controller = new AppController(() => undefined, null, () => '#/recover-password');

    expect(controller.getPage()).toBe('reset-password');
  });

  it('subscribes to hashchange when an event target is given', () => {
    const eventTarget = jasmine.createSpyObj('eventTarget', ['addEventListener', 'removeEventListener']);
    const controller = new AppController(() => undefined, eventTarget, () => '#/');

    controller.buildEffect()();

    expect(eventTarget.addEventListener).toHaveBeenCalledWith('hashchange', jasmine.any(Function));
  });

  it('updates the page when the hash changes', () => {
    const setPage = jasmine.createSpy('setPage');
    const eventTarget = jasmine.createSpyObj('eventTarget', ['addEventListener', 'removeEventListener']);
    let hash = '#/';
    const controller = new AppController(setPage, eventTarget, () => hash);

    controller.buildEffect()();
    const handler = eventTarget.addEventListener.calls.mostRecent().args[1];
    hash = '#/recover-password';
    handler();

    expect(setPage).toHaveBeenCalledWith('reset-password');
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
