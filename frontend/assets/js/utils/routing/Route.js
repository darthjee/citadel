/**
 * Route model to match hash paths and extract dynamic params.
 */
export default class Route {
  #segments;

  #page;

  /**
   * Create a route matcher.
   *
   * @param {string} path - Route pattern path (e.g. `/games/:id`).
   * @param {string} page - Page identifier returned when this route matches.
   */
  constructor(path, page) {
    this.#segments = Route.#split(path);
    this.#page = page;
  }

  /**
   * Split a path into segments, dropping one trailing empty segment.
   *
   * @description The trailing empty segment is only dropped when there is more than one
   * segment, so the root path `'/'` becomes `['']` and a trailing slash is optional.
   * @param {string} path - Path or route pattern to split.
   * @returns {string[]} Path segments.
   */
  static #split(path) {
    const segments = path.split('/');

    if (segments.length > 1 && segments.at(-1) === '') {
      segments.pop();
    }

    return segments;
  }

  /**
   * Compare one pattern segment against one path segment.
   *
   * @param {string} expected - Pattern segment (static or `:name`).
   * @param {string} actual - Path segment.
   * @returns {Array|null} `null` on mismatch, `[]` for a matching static segment, or a
   * one-element list holding the `[name, value]` pair for a param segment.
   */
  static #matchSegment(expected, actual) {
    if (!expected.startsWith(':')) {
      return expected === actual ? [] : null;
    }

    return actual === '' ? null : [[expected.slice(1), actual]];
  }

  /**
   * Match a path against this route's segments.
   *
   * @param {string} path - Path to match.
   * @returns {object|null} Route params map, or `null` when the path does not match.
   */
  #match(path) {
    const segments = Route.#split(path);

    if (segments.length !== this.#segments.length) {
      return null;
    }

    const entries = [];

    for (const [index, expected] of this.#segments.entries()) {
      const matched = Route.#matchSegment(expected, segments.at(index));

      if (matched === null) {
        return null;
      }

      entries.push(...matched);
    }

    return Object.fromEntries(entries);
  }

  /**
   * Check whether a path matches this route.
   *
   * @param {string} path - Path to check.
   * @returns {boolean} True when the path matches.
   */
  matches(path) {
    return this.#match(path) !== null;
  }

  /**
   * Extract named params from a matching path.
   *
   * @param {string} path - Path to parse.
   * @returns {object} Route params map, empty when the path does not match.
   */
  params(path) {
    return this.#match(path) ?? {};
  }

  /**
   * Return the page identifier for this route.
   *
   * @returns {string} Page identifier.
   */
  get page() {
    return this.#page;
  }
}
