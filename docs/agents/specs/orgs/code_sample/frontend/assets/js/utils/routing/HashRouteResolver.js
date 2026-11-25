import Router from './Router.js';
import { ROUTES_CONTEXT, ROUTES_ORG_ONLY, ROUTES_PERSONAL } from './routes.js';
import {
  PERSONAL,
  hashPath,
  organizationContext,
  splitOrgPrefix,
} from '../context/ownerContext.js';

/**
 * Read the current browser location hash, SSR-safe.
 *
 * @returns {string} The current `window.location.hash`, or `''` when `window` is not
 *   defined (e.g. during a Node-based spec run).
 */
function defaultHashProvider() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Build a router over a `[path, page key]` table.
 *
 * @param {Array<Array<string>>} routes - The route table.
 * @returns {Router} The router.
 */
function buildRouter(routes) {
  const router = new Router();

  routes.forEach(([path, key]) => router.register(path, key));

  return router;
}

/**
 * Resolver for hash-based application routes: owns the route tables and reads the current URL
 * hash to resolve it to a `{ page, context }` route.
 *
 * @description Lookup order: Personal-only routes (full path) → `/orgs/<id>` prefix (malformed
 * id → `not-found`; otherwise organization-only then context routes against the rest) →
 * context routes as Personal → `home`.
 */
export default class HashRouteResolver {
  #hashProvider;

  #personalRouter;

  #orgOnlyRouter;

  #contextRouter;

  /**
   * Build a resolver instance.
   *
   * @param {Function} [hashProvider] - Function returning the current hash.
   * @param {{contextRoutes: Array<Array<string>>}} [options] - Resolver options;
   *   `contextRoutes` overrides the context-aware route table (used by specs).
   */
  constructor(hashProvider = defaultHashProvider, { contextRoutes = ROUTES_CONTEXT } = {}) {
    this.#hashProvider = hashProvider;
    this.#personalRouter = buildRouter(ROUTES_PERSONAL);
    this.#orgOnlyRouter = buildRouter(ROUTES_ORG_ONLY);
    this.#contextRouter = buildRouter(contextRoutes);
  }

  /**
   * Return the current hash.
   *
   * @returns {string} Current hash value.
   */
  currentHash() {
    return this.#hashProvider();
  }

  /**
   * Resolve the current hash into a route.
   *
   * @returns {{page: string, context: object}} The page key and its owner context.
   */
  resolve() {
    const path = hashPath(this.currentHash()) || '/';
    const personalPage = this.#personalRouter.match(path);

    if (personalPage) {
      return { page: personalPage, context: PERSONAL };
    }

    const prefix = splitOrgPrefix(path);
    const route = prefix ? this.#resolveOrganization(prefix) : this.#resolveContext(path, PERSONAL);

    return route ?? { page: 'home', context: PERSONAL };
  }

  /**
   * Resolve a path carrying an `/orgs/<seg>` prefix.
   *
   * @param {{orgId: (number|null), rest: string}} prefix - The split prefix.
   * @returns {{page: string, context: object}|null} The route, or `null` when nothing matches.
   */
  #resolveOrganization({ orgId, rest }) {
    if (orgId === null) {
      return { page: 'not-found', context: PERSONAL };
    }

    const context = organizationContext(orgId);
    const page = this.#orgOnlyRouter.match(rest);

    return page ? { page, context } : this.#resolveContext(rest, context);
  }

  /**
   * Match a path against the context-aware routes.
   *
   * @param {string} path - The (stripped) path.
   * @param {object} context - The owner context to attach.
   * @returns {{page: string, context: object}|null} The route, or `null` when nothing matches.
   */
  #resolveContext(path, context) {
    const page = this.#contextRouter.match(path);

    return page ? { page, context } : null;
  }
}
