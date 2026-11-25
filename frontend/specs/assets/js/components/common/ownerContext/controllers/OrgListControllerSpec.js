import OrgListController, {
  EMPTY_ORG_STATE,
  buildOrgListEffect,
} from '../../../../../../../assets/js/components/common/ownerContext/controllers/OrgListController.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import OrganizationsClient from '../../../../../../../assets/js/client/OrganizationsClient.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

const ORGS = [{ id: 5, name: 'Acme', role: 'owner' }];

function login(userId) {
  return { detail: { loggedIn: true, isAdmin: false, userId } };
}

function loaded(userId, orgs = ORGS) {
  return {
    userId, orgs, orgsLoaded: true, orgsError: null,
  };
}

describe('OrgListController', () => {
  let setState;
  let client;
  let onSessionLoaded;
  let controller;

  beforeEach(() => {
    setState = jasmine.createSpy('setState');
    client = jasmine.createSpyObj('client', ['list']);
    client.list.and.resolveTo(ORGS);
    onSessionLoaded = jasmine.createSpy('onSessionLoaded');
    controller = new OrgListController(setState, { client, onSessionLoaded });
  });

  describe('#handleAuthChanged', () => {
    it('loads the list on login and records the user id', async () => {
      await controller.handleAuthChanged(login(1));

      expect(client.list).toHaveBeenCalledTimes(1);
      expect(setState.calls.argsFor(0)).toEqual([{ ...EMPTY_ORG_STATE, userId: 1 }]);
      expect(setState.calls.mostRecent().args[0]).toEqual(loaded(1));
    });

    it('calls onSessionLoaded with the loaded state', async () => {
      await controller.handleAuthChanged(login(1));

      expect(onSessionLoaded).toHaveBeenCalledOnceWith(loaded(1));
    });

    it('does not reload on a repeated login event for the same user', async () => {
      await controller.handleAuthChanged(login(1));
      await controller.handleAuthChanged(login(1));

      expect(client.list).toHaveBeenCalledTimes(1);
      expect(onSessionLoaded).toHaveBeenCalledTimes(1);
    });

    it('reloads for another user', async () => {
      await controller.handleAuthChanged(login(1));
      await controller.handleAuthChanged(login(2));

      expect(client.list).toHaveBeenCalledTimes(2);
      expect(setState.calls.mostRecent().args[0]).toEqual(loaded(2));
    });

    it('clears on logout', async () => {
      await controller.handleAuthChanged(login(1));
      await controller.handleAuthChanged({ detail: { loggedIn: false } });

      expect(setState.calls.mostRecent().args[0]).toBe(EMPTY_ORG_STATE);
    });

    it('reloads after a logout and a new login of the same user', async () => {
      await controller.handleAuthChanged(login(1));
      await controller.handleAuthChanged({ detail: { loggedIn: false } });
      await controller.handleAuthChanged(login(1));

      expect(client.list).toHaveBeenCalledTimes(2);
    });

    it('clears without a user id, without loading', async () => {
      await controller.handleAuthChanged({ detail: { loggedIn: true, userId: null } });

      expect(client.list).not.toHaveBeenCalled();
      expect(setState).toHaveBeenCalledOnceWith(EMPTY_ORG_STATE);
    });

    it('clears on an event without detail', async () => {
      await controller.handleAuthChanged({});

      expect(setState).toHaveBeenCalledOnceWith(EMPTY_ORG_STATE);
    });

    it('publishes an error state on a failed load', async () => {
      client.list.and.rejectWith(new ApiError(500, 'boom'));

      await controller.handleAuthChanged(login(1));

      expect(setState.calls.mostRecent().args[0]).toEqual({
        userId: 1, orgs: [], orgsLoaded: true, orgsError: 'boom',
      });
      expect(onSessionLoaded).toHaveBeenCalledTimes(1);
    });

    it('falls back to a generic error message', async () => {
      client.list.and.rejectWith(new Error(''));

      await controller.handleAuthChanged(login(1));

      expect(setState.calls.mostRecent().args[0].orgsError).toBe('Request failed');
    });

    it('leaves the list unloaded on a session expiry so the next login reloads it', async () => {
      const expired = new ApiError(401, 'Unauthorized');

      expired.sessionExpired = true;
      client.list.and.returnValues(Promise.reject(expired), Promise.resolve(ORGS));

      await controller.handleAuthChanged(login(1));

      expect(setState).toHaveBeenCalledTimes(1);
      expect(onSessionLoaded).not.toHaveBeenCalled();

      await controller.handleAuthChanged(login(1));

      expect(client.list).toHaveBeenCalledTimes(2);
      expect(setState.calls.mostRecent().args[0]).toEqual(loaded(1));
    });

    it('ignores a late answer from a previous session', async () => {
      let resolveFirst;

      client.list.and.returnValues(new Promise((resolve) => {
        resolveFirst = resolve;
      }), Promise.resolve([]));

      const first = controller.handleAuthChanged(login(1));

      await controller.handleAuthChanged(login(2));
      resolveFirst(ORGS);
      await first;

      expect(setState.calls.mostRecent().args[0]).toEqual(loaded(2, []));
      expect(onSessionLoaded).toHaveBeenCalledOnceWith(loaded(2, []));
    });
  });

  describe('#refresh', () => {
    it('refetches the list of the current session', async () => {
      await controller.handleAuthChanged(login(1));
      client.list.and.resolveTo([]);

      await controller.refresh();

      expect(client.list).toHaveBeenCalledTimes(2);
      expect(setState.calls.mostRecent().args[0]).toEqual(loaded(1, []));
      expect(onSessionLoaded).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when logged out', async () => {
      await controller.refresh();

      expect(client.list).not.toHaveBeenCalled();
      expect(setState).not.toHaveBeenCalled();
    });
  });

  it('defaults to OrganizationsClient', async () => {
    spyOn(OrganizationsClient, 'list').and.resolveTo(ORGS);
    const defaultController = new OrgListController(setState);

    await defaultController.handleAuthChanged(login(1));

    expect(OrganizationsClient.list).toHaveBeenCalled();
    expect(setState.calls.mostRecent().args[0]).toEqual(loaded(1));
  });
});

describe('buildOrgListEffect', () => {
  beforeEach(() => {
    installFakeWindow(new EventTarget());
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('forwards AuthEvents to the controller until cleaned up', () => {
    const controller = jasmine.createSpyObj('controller', ['handleAuthChanged']);
    const cleanup = buildOrgListEffect(controller)();

    AuthEvents.emit(true, false, false, 3);

    expect(controller.handleAuthChanged).toHaveBeenCalledTimes(1);
    expect(controller.handleAuthChanged.calls.argsFor(0)[0].detail.userId).toBe(3);

    cleanup();
    AuthEvents.emit(false);

    expect(controller.handleAuthChanged).toHaveBeenCalledTimes(1);
  });

  it('accepts an event bus override', () => {
    const events = jasmine.createSpyObj('events', ['subscribe', 'unsubscribe']);
    const cleanup = buildOrgListEffect({}, events)();

    expect(events.subscribe).toHaveBeenCalledWith(jasmine.any(Function));

    cleanup();

    expect(events.unsubscribe).toHaveBeenCalledWith(events.subscribe.calls.argsFor(0)[0]);
  });
});
