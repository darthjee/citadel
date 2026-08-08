import Router from './Router.js';

/**
 * Ordered `[path, page key]` route table registered on every resolver instance. Order
 * matters: routes are matched top-to-bottom, so more specific paths must be listed before
 * their more generic siblings.
 *
 * @type {Array<Array<string>>}
 */
const ROUTES = [
  ['/recover-password', 'reset-password'],
  ['/admin/users/:id/edit', 'admin-user-edit'],
  ['/admin/users', 'admin-users'],
  ['/account/authorization-requests', 'authorization-requests'],
  ['/account/my-account', 'my-account'],
  ['/', 'home'],
];

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
 * Resolver for hash-based application routes: owns the route table and reads the current
 * URL hash to resolve it to a page identifier.
 */
export default class HashRouteResolver {
  #hashProvider;

  #router;

  /**
   * Build a resolver instance.
   *
   * @param {Function} [hashProvider] - Function returning the current hash.
   */
  constructor(hashProvider = defaultHashProvider) {
    this.#hashProvider = hashProvider;
    this.#router = new Router();

    ROUTES.forEach(([path, key]) => this.#router.register(path, key));
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
   * Resolve the current hash into a page key.
   *
   * @returns {string} Page identifier.
   */
  getPage() {
    const route = this.currentHash().split('?')[0].replace(/^#/, '');
    return this.#router.resolve(route || '/');
  }
}
