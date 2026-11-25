import {
  isEntryHash,
  resolveEntry,
  runEntryResolution,
  trackVisit,
} from '../../../../../assets/js/utils/context/entryResolution.js';
import { buildContextStorage } from '../../../../../assets/js/utils/context/ContextStorage.js';
import OrgListController from '../../../../../assets/js/components/common/ownerContext/controllers/OrgListController.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../support/fakeWindow.js';
import { fetchSequence } from '../../../../support/fetchSequence.js';

const PERSONAL = { kind: 'personal' };
const ORGS = [{ id: 5, name: 'Acme', role: 'owner' }, { id: 6, name: 'Beta', role: 'user' }];

function memoryStorage() {
  const store = new Map();

  return {
    store,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

describe('entryResolution', () => {
  let backend;
  let storage;

  beforeEach(() => {
    backend = memoryStorage();
    storage = buildContextStorage(() => backend);
  });

  describe('isEntryHash', () => {
    ['', '#', '#/', '#/?x=1'].forEach((hash) => {
      it(`treats ${JSON.stringify(hash)} as an entry`, () => {
        expect(isEntryHash(hash)).toBe(true);
      });
    });

    ['#/account/my-account', '#/orgs/5', '#/orgs/new'].forEach((hash) => {
      it(`does not treat ${hash} as an entry`, () => {
        expect(isEntryHash(hash)).toBe(false);
      });
    });
  });

  describe('resolveEntry', () => {
    const resolve = (overrides = {}) => resolveEntry({
      hash: '#/', userId: 1, orgs: ORGS, orgsError: null, storage, ...overrides,
    });

    it('redirects to the remembered organization when it is in the list', () => {
      storage.rememberOrganization(1, 6);

      expect(resolve()).toBe('#/orgs/6');
    });

    it('redirects from an empty hash too', () => {
      storage.rememberOrganization(1, 5);

      expect(resolve({ hash: '' })).toBe('#/orgs/5');
    });

    it('stays Personal when nothing is remembered', () => {
      expect(resolve()).toBeNull();
    });

    it('forgets a remembered organization that is not in the list and stays Personal', () => {
      storage.rememberOrganization(1, 9);

      expect(resolve()).toBeNull();
      expect(storage.read(1)).toBeNull();
    });

    it('does not redirect from a non-entry unprefixed path', () => {
      storage.rememberOrganization(1, 5);

      expect(resolve({ hash: '#/account/my-account' })).toBeNull();
      expect(storage.read(1)).toBe(5);
    });

    it('stays Personal without forgetting on a failed list load', () => {
      storage.rememberOrganization(1, 5);

      expect(resolve({ orgs: [], orgsError: 'boom' })).toBeNull();
      expect(storage.read(1)).toBe(5);
    });

    it('only reads the current user remembered context', () => {
      storage.rememberOrganization(2, 5);

      expect(resolve()).toBeNull();
      expect(storage.read(2)).toBe(5);
    });

    it('tolerates a missing org list', () => {
      storage.rememberOrganization(1, 5);

      expect(resolve({ orgs: undefined })).toBeNull();
    });
  });

  describe('runEntryResolution', () => {
    it('navigates to the resolved target', () => {
      const navigate = jasmine.createSpy('navigate');

      storage.rememberOrganization(1, 5);
      const target = runEntryResolution(
        { userId: 1, orgs: ORGS, orgsError: null },
        { hashProvider: () => '#/', navigate, storage },
      );

      expect(target).toBe('#/orgs/5');
      expect(navigate).toHaveBeenCalledWith('#/orgs/5');
    });

    it('does not navigate when staying Personal', () => {
      const navigate = jasmine.createSpy('navigate');

      runEntryResolution({ userId: 1, orgs: ORGS, orgsError: null }, { hashProvider: () => '#/', navigate, storage });

      expect(navigate).not.toHaveBeenCalled();
    });

    describe('with the browser defaults', () => {
      afterEach(() => {
        uninstallFakeWindow();
      });

      it('reads and sets window.location.hash', () => {
        const fakeWindow = installFakeWindow({ location: { hash: '#/' } });

        storage.rememberOrganization(1, 5);
        runEntryResolution({ userId: 1, orgs: ORGS, orgsError: null }, { storage });

        expect(fakeWindow.location.hash).toBe('#/orgs/5');
      });

      it('is a no-op without a window', () => {
        expect(runEntryResolution({ userId: 1, orgs: ORGS, orgsError: null }, { storage })).toBeNull();
      });
    });
  });

  describe('end to end with the org list load', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('sends no request about a stale remembered id', async () => {
      const navigate = jasmine.createSpy('navigate');
      const controller = new OrgListController(() => undefined, {
        onSessionLoaded: (state) => runEntryResolution(state, { hashProvider: () => '#/', navigate, storage }),
      });

      storage.rememberOrganization(1, 9);
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: ORGS }]);

      await controller.handleAuthChanged({ detail: { loggedIn: true, userId: 1 } });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/orgs.json');
      expect(navigate).not.toHaveBeenCalled();
      expect(storage.read(1)).toBeNull();
    });
  });

  describe('trackVisit', () => {
    const contextRoutes = [['/x', 'x-page']];
    const org = { kind: 'organization', orgId: 5 };

    it('remembers the organization of an organization page', () => {
      trackVisit({ page: 'org-overview', context: org }, 1, { storage, contextRoutes });

      expect(storage.read(1)).toBe(5);
    });

    it('remembers the organization of the edit page', () => {
      trackVisit({ page: 'org-edit', context: { kind: 'organization', orgId: 6 } }, 1, { storage, contextRoutes });

      expect(storage.read(1)).toBe(6);
    });

    it('remembers the organization of a context-aware module page', () => {
      trackVisit({ page: 'x-page', context: org }, 1, { storage, contextRoutes });

      expect(storage.read(1)).toBe(5);
    });

    it('remembers Personal for a Personal context-aware page', () => {
      storage.rememberOrganization(1, 5);
      trackVisit({ page: 'x-page', context: PERSONAL }, 1, { storage, contextRoutes });

      expect(storage.read(1)).toBeNull();
    });

    ['home', 'my-account', 'admin-users', 'reset-password', 'org-new', 'not-found'].forEach((page) => {
      it(`leaves the remembered context unchanged on the neutral ${page} page`, () => {
        storage.rememberOrganization(1, 5);
        trackVisit({ page, context: PERSONAL }, 1, { storage, contextRoutes });

        expect(storage.read(1)).toBe(5);
      });
    });

    it('does nothing without a user id', () => {
      trackVisit({ page: 'org-overview', context: org }, null, { storage, contextRoutes });

      expect(backend.store.size).toBe(0);
    });

    it('defaults to the app context routes', () => {
      storage.rememberOrganization(1, 5);
      trackVisit({ page: 'x-page', context: PERSONAL }, 1, { storage });

      expect(storage.read(1)).toBe(5);
    });
  });
});
