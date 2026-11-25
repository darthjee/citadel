import HashRouteResolver from '../utils/routing/HashRouteResolver.js';

/**
 * Controller for application-level hash routing: resolves the current route (page key and
 * owner context) and keeps it in sync with `hashchange` events.
 */
export default class AppController {
  /**
   * Create an app controller.
   *
   * @param {Function} setRoute - React state setter for the current `{ page, context }` route.
   * @param {EventTarget|null} [eventTarget] - Target used to listen for hash changes; pass
   *   `null` to disable the listener (used outside the browser).
   * @param {Function} [hashProvider] - Function returning the current hash.
   */
  constructor(
    setRoute,
    eventTarget = typeof window === 'undefined' ? null : window,
    hashProvider = undefined,
  ) {
    this.setRoute = setRoute;
    this.eventTarget = eventTarget;
    this.routeResolver = new HashRouteResolver(hashProvider);
  }

  /**
   * Resolve the current route from the hash.
   *
   * @returns {{page: string, context: object}} The current page key and its owner context.
   */
  getRoute() {
    return this.routeResolver.resolve();
  }

  /**
   * Build the react effect that listens for hash changes and keeps the route state in sync.
   *
   * @returns {Function} Effect callback, returning a cleanup function (or `undefined` when
   *   no event target is available).
   */
  buildEffect() {
    return () => {
      if (!this.eventTarget) {
        return undefined;
      }

      const handleHashChange = () => this.setRoute(this.getRoute());

      this.eventTarget.addEventListener('hashchange', handleHashChange);

      return () => this.eventTarget.removeEventListener('hashchange', handleHashChange);
    };
  }
}
