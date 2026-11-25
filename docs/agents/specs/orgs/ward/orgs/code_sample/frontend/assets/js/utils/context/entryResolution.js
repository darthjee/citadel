import ContextStorage from './ContextStorage.js';
import { hashPath, landingFor, organizationContext } from './ownerContext.js';
import { ROUTES_CONTEXT } from '../routing/routes.js';

/** Organization-only pages, always context-aware. */
const ORG_PAGES = ['org-overview', 'org-edit'];

/**
 * Read the current browser location hash, SSR-safe.
 *
 * @returns {string} The current hash, or `''` when `window` is not defined.
 */
function defaultHashProvider() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Navigate to a hash, SSR-safe.
 *
 * @param {string} hash - The hash to navigate to.
 * @returns {void} Nothing.
 */
function defaultNavigate(hash) {
  if (typeof window !== 'undefined') {
    window.location.hash = hash;
  }
}

/**
 * Check whether a hash is an entry point (empty or the root).
 *
 * @param {string} hash - The raw hash value.
 * @returns {boolean} True for `''`, `#` and `#/` (query string ignored).
 */
export function isEntryHash(hash) {
  const path = hashPath(hash);

  return path === '' || path === '/';
}

/**
 * Decide where an entry point should land once the org list has loaded.
 *
 * @description Only an entry hash (see {@link isEntryHash}) with a successfully loaded list is
 * redirected: when the remembered org id is in `orgs`, to its landing; otherwise the stale id is
 * forgotten and the user stays Personal. A failed load stays Personal without forgetting. No
 * request is ever sent about the remembered id itself.
 * @param {{hash: string, userId: (number|null), orgs: Array<object>, orgsError: (string|null),
 *   storage: object}} state - The entry state; `storage` defaults to {@link ContextStorage}.
 * @returns {string|null} The hash to redirect to, or `null` to stay put (Personal).
 */
export function resolveEntry({
  hash, userId, orgs, orgsError, storage = ContextStorage,
}) {
  if (orgsError || !isEntryHash(hash)) {
    return null;
  }

  const remembered = storage.read(userId);

  if (remembered === null) {
    return null;
  }

  if ((orgs ?? []).some((org) => org.id === remembered)) {
    return landingFor(organizationContext(remembered));
  }

  storage.forgetIfMatches(userId, remembered);

  return null;
}

/**
 * Run entry resolution against the current hash and navigate when it yields a target.
 *
 * @param {{userId: (number|null), orgs: Array<object>, orgsError: (string|null)}} state - The
 *   loaded org-list state.
 * @param {{hashProvider: Function, navigate: Function, storage: object}} [deps] - Injectable
 *   dependencies (default: the browser hash and {@link ContextStorage}).
 * @returns {string|null} The hash navigated to, or `null`.
 */
export function runEntryResolution(state, {
  hashProvider = defaultHashProvider, navigate = defaultNavigate, storage = ContextStorage,
} = {}) {
  const target = resolveEntry({ ...state, hash: hashProvider(), storage });

  if (target) {
    navigate(target);
  }

  return target;
}

/**
 * Check whether a page is context-aware (its visit updates the "last used" context).
 *
 * @param {string} page - The page key.
 * @param {Array<Array<string>>} contextRoutes - The context-aware route table.
 * @returns {boolean} True for organization-only pages and context-aware module pages.
 */
function isContextAwarePage(page, contextRoutes) {
  return ORG_PAGES.includes(page) || contextRoutes.some(([, key]) => key === page);
}

/**
 * Remember the context of a visited context-aware page.
 *
 * @description Organization context → `rememberOrganization`; Personal context-aware page →
 * `rememberPersonal`. Context-neutral pages (home, my account, admin, recover password,
 * `org-new`, `not-found`) leave the remembered context unchanged.
 * @param {{page: string, context: object}} route - The visited route.
 * @param {number|null} userId - The logged-in user id (no-op without one).
 * @param {{storage: object, contextRoutes: Array<Array<string>>}} [deps] - Injectable
 *   dependencies (default: {@link ContextStorage} and the app's context routes).
 * @returns {void} Nothing.
 */
export function trackVisit(route, userId, {
  storage = ContextStorage, contextRoutes = ROUTES_CONTEXT,
} = {}) {
  if (!userId || !isContextAwarePage(route.page, contextRoutes)) {
    return;
  }

  if (route.context.kind === 'organization') {
    storage.rememberOrganization(userId, route.context.orgId);
  } else {
    storage.rememberPersonal(userId);
  }
}
