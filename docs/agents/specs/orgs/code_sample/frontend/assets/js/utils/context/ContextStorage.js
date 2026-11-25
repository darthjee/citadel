import { parseOrgId } from './ownerContext.js';

const KEY_PREFIX = 'ward.context.';

/**
 * Resolve the browser's `localStorage` lazily; SSR/spec-safe.
 *
 * @returns {Storage|undefined} The storage, or `undefined` when unavailable.
 */
function defaultStorage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

/**
 * Run a storage access, swallowing any error (missing or throwing storage).
 *
 * @param {Function} resolveStorage - Resolves the storage backend.
 * @param {Function} access - Receives the storage and performs the access.
 * @returns {*} The access result, or `null` when the storage is missing or throws.
 */
function safely(resolveStorage, access) {
  try {
    const storage = resolveStorage();

    return storage ? access(storage) : null;
  } catch {
    return null;
  }
}

/**
 * Build the storage key for a user.
 *
 * @param {number} userId - The user id.
 * @returns {string} The key `ward.context.<userId>`.
 */
function keyFor(userId) {
  return `${KEY_PREFIX}${userId}`;
}

/**
 * Build a context store over a storage backend.
 *
 * @description The stored value is the org id only (never a name); an absent key means
 * Personal. Every access is guarded: a missing or throwing storage reads as Personal and writes
 * are no-ops. Without a `userId`, every method is a no-op returning `null`.
 * @param {Function} resolveStorage - Resolves the `getItem`/`setItem`/`removeItem` backend.
 * @returns {object} The context store.
 */
export function buildContextStorage(resolveStorage) {
  const store = {
    /**
     * Read the user's remembered organization id.
     *
     * @param {number} userId - The user id.
     * @returns {number|null} The validated org id, or `null` for Personal.
     */
    read(userId) {
      if (!userId) {
        return null;
      }

      return safely(resolveStorage, (storage) => parseOrgId(storage.getItem(keyFor(userId))));
    },

    /**
     * Remember an organization as the user's last context.
     *
     * @param {number} userId - The user id.
     * @param {number} orgId - The organization id.
     * @returns {void} Nothing.
     */
    rememberOrganization(userId, orgId) {
      if (userId) {
        safely(resolveStorage, (storage) => storage.setItem(keyFor(userId), String(orgId)));
      }
    },

    /**
     * Remember Personal as the user's last context (removes the key).
     *
     * @param {number} userId - The user id.
     * @returns {void} Nothing.
     */
    rememberPersonal(userId) {
      store.forget(userId);
    },

    /**
     * Forget the user's remembered context.
     *
     * @param {number} userId - The user id.
     * @returns {void} Nothing.
     */
    forget(userId) {
      if (userId) {
        safely(resolveStorage, (storage) => storage.removeItem(keyFor(userId)));
      }
    },

    /**
     * Forget the user's remembered context only when it is the given (stale) organization.
     *
     * @param {number} userId - The user id.
     * @param {number} orgId - The organization id found to be stale.
     * @returns {void} Nothing.
     */
    forgetIfMatches(userId, orgId) {
      if (store.read(userId) === orgId) {
        store.forget(userId);
      }
    },
  };

  return store;
}

/**
 * Per-user "last used context" store, keyed `ward.context.<userId>` in `window.localStorage`.
 * Logout does not clear it.
 */
const ContextStorage = buildContextStorage(defaultStorage);

export default ContextStorage;
