import PermissionEvents from '../../../../client/PermissionEvents.js';

/**
 * Build the forbidden-refresh effect: refreshes the caller's role whenever the API answers
 * `403 Forbidden`.
 *
 * @description Subscribes to the shared {@link PermissionEvents} bus and calls `refresh` on
 * each event. A burst of 403s triggers a single refresh: events arriving while a refresh is in
 * flight are ignored. Returns a cleanup that unsubscribes. Exported so specs can run it without
 * a React renderer.
 * @param {Function} refresh - Refetches the org list (and therefore the role); may return a
 *   promise.
 * @param {typeof PermissionEvents} [events] - Permission event bus override, for testability.
 * @returns {Function} Effect callback, returning a cleanup function.
 */
export default function buildForbiddenRefreshEffect(refresh, events = PermissionEvents) {
  return () => {
    let inFlight = false;

    const handleForbidden = async () => {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        await refresh();
      } finally {
        inFlight = false;
      }
    };

    return events.onForbidden(handleForbidden);
  };
}
