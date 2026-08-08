import Route from './Route.js';

const TEMP_PAGE = '_internal_extract_params_';

/**
 * Ordered route registry and resolver: matches a path against its registered
 * routes, first match wins.
 */
export default class Router {
  #routes = [];

  /**
   * Register a path pattern and its page identifier.
   *
   * @param {string} path - Route pattern path.
   * @param {string} page - Page identifier.
   * @returns {void} Nothing.
   */
  register(path, page) {
    this.#routes.push(new Route(path, page));
  }

  /**
   * Resolve a path into a page identifier.
   *
   * @param {string} path - Path to resolve.
   * @returns {string} Matching page identifier, or `'home'` when no route matches.
   */
  resolve(path) {
    const match = this.#routes.find((route) => route.matches(path));
    return match ? match.page : 'home';
  }

  /**
   * Extract named params from a path pattern against a raw hash value.
   *
   * @param {string} path - Route pattern to parse (e.g. `/games/:id`).
   * @param {string} [hash] - Hash value, with an optional leading `#` and query string.
   * @returns {object} Route params map.
   */
  static extractParams(path, hash = '') {
    const normalizedHash = String(hash).split('?')[0].replace(/^#/, '');
    return new Route(path, TEMP_PAGE).params(normalizedHash);
  }
}
