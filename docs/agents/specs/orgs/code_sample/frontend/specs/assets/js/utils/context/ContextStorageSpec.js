import ContextStorage, { buildContextStorage } from '../../../../../assets/js/utils/context/ContextStorage.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../support/fakeWindow.js';

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    store,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

function throwingStorage() {
  const fail = () => {
    throw new Error('storage disabled');
  };

  return { getItem: fail, setItem: fail, removeItem: fail };
}

describe('ContextStorage', () => {
  let storage;
  let subject;

  beforeEach(() => {
    storage = memoryStorage();
    subject = buildContextStorage(() => storage);
  });

  describe('.read', () => {
    it('reads null (Personal) when nothing is stored', () => {
      expect(subject.read(1)).toBeNull();
    });

    it('reads a remembered organization id', () => {
      subject.rememberOrganization(1, 5);

      expect(subject.read(1)).toBe(5);
      expect(storage.store.get('ward.context.1')).toBe('5');
    });

    it('keeps users isolated', () => {
      subject.rememberOrganization(2, 7);

      expect(subject.read(1)).toBeNull();
      expect(subject.read(2)).toBe(7);
    });

    ['abc', '007', '0', '2147483648', '{"orgId":5}', ''].forEach((value) => {
      it(`reads the garbage value ${JSON.stringify(value)} as null`, () => {
        storage.store.set('ward.context.1', value);

        expect(subject.read(1)).toBeNull();
      });
    });

    it('reads null without a user id', () => {
      storage.store.set('ward.context.undefined', '5');

      expect(subject.read(undefined)).toBeNull();
    });
  });

  describe('.rememberPersonal', () => {
    it('removes the key', () => {
      subject.rememberOrganization(1, 5);
      subject.rememberPersonal(1);

      expect(storage.store.has('ward.context.1')).toBe(false);
    });
  });

  describe('.forget', () => {
    it('removes only the given user key', () => {
      subject.rememberOrganization(1, 5);
      subject.rememberOrganization(2, 6);
      subject.forget(1);

      expect(subject.read(1)).toBeNull();
      expect(subject.read(2)).toBe(6);
    });
  });

  describe('.forgetIfMatches', () => {
    it('forgets a matching stale id', () => {
      subject.rememberOrganization(1, 5);
      subject.forgetIfMatches(1, 5);

      expect(subject.read(1)).toBeNull();
    });

    it('keeps a different remembered id', () => {
      subject.rememberOrganization(1, 6);
      subject.forgetIfMatches(1, 5);

      expect(subject.read(1)).toBe(6);
    });
  });

  describe('without a user id', () => {
    it('does not write', () => {
      subject.rememberOrganization(undefined, 5);
      subject.forget(null);

      expect(storage.store.size).toBe(0);
    });
  });

  describe('with a throwing storage', () => {
    beforeEach(() => {
      subject = buildContextStorage(() => throwingStorage());
    });

    it('reads null', () => {
      expect(subject.read(1)).toBeNull();
    });

    it('swallows write and remove errors', () => {
      expect(() => subject.rememberOrganization(1, 5)).not.toThrow();
      expect(() => subject.rememberPersonal(1)).not.toThrow();
      expect(() => subject.forgetIfMatches(1, 5)).not.toThrow();
    });
  });

  describe('with a storage resolver that throws', () => {
    it('reads null', () => {
      subject = buildContextStorage(() => {
        throw new Error('SecurityError');
      });

      expect(subject.read(1)).toBeNull();
    });
  });

  describe('with no storage at all', () => {
    it('reads null and ignores writes', () => {
      subject = buildContextStorage(() => undefined);

      expect(() => subject.rememberOrganization(1, 5)).not.toThrow();
      expect(subject.read(1)).toBeNull();
    });
  });

  describe('default instance', () => {
    afterEach(() => {
      uninstallFakeWindow();
    });

    it('uses window.localStorage', () => {
      const local = memoryStorage({ 'ward.context.3': '9' });

      installFakeWindow({ localStorage: local });

      expect(ContextStorage.read(3)).toBe(9);
    });

    it('reads null when there is no window', () => {
      expect(ContextStorage.read(3)).toBeNull();
    });
  });
});
