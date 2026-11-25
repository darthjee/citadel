import AuthEvents from '../../../../client/AuthEvents.js';
import { isSessionExpired } from '../../../../client/isSessionExpired.js';
import OrganizationsClient from '../../../../client/OrganizationsClient.js';

/** Org-list state of a logged-out session. */
export const EMPTY_ORG_STATE = Object.freeze({
  userId: null, orgs: [], orgsLoaded: false, orgsError: null,
});

/**
 * Keeps the in-memory organization list in sync with the session.
 *
 * @description Fetches `GET /orgs.json` once per session, on the first logged-in `AuthEvents`
 * event for a user (never on navigation); `refresh()` refetches. A logged-out event clears the
 * list, the user id and the error. A failed load sets `orgsError` and never throws; a
 * session-expired rejection leaves the list unloaded so the next login reloads it.
 * Late answers from a previous session are ignored.
 */
export default class OrgListController {
  #setState;

  #client;

  #onSessionLoaded;

  #sessionUserId = null;

  #generation = 0;

  /**
   * Create an org-list controller.
   *
   * @param {Function} setState - React state setter receiving the next org-list state.
   * @param {{client: object, onSessionLoaded: Function}} [options] - `client` overrides
   *   {@link OrganizationsClient}; `onSessionLoaded` is called with the state after the first
   *   load of each session (used for entry resolution).
   */
  constructor(setState, { client = OrganizationsClient, onSessionLoaded = () => undefined } = {}) {
    this.#setState = setState;
    this.#client = client;
    this.#onSessionLoaded = onSessionLoaded;
  }

  /**
   * React to an `AuthEvents` change.
   *
   * @param {CustomEvent} event - The auth event; `detail` carries `loggedIn` and `userId`.
   * @returns {Promise<void>} Resolves once any triggered load finishes.
   */
  async handleAuthChanged(event) {
    const { loggedIn, userId } = event.detail ?? {};

    if (!loggedIn || !userId) {
      this.clear();
      return;
    }

    if (userId === this.#sessionUserId) {
      return;
    }

    this.#sessionUserId = userId;
    this.#generation += 1;
    this.#setState({ ...EMPTY_ORG_STATE, userId });

    const state = await this.#load();

    if (state) {
      this.#onSessionLoaded(state);
    }
  }

  /**
   * Refetch the organization list of the current session (after a create or a rename).
   *
   * @returns {Promise<void>} Resolves once the load finishes; a no-op when logged out.
   */
  async refresh() {
    if (this.#sessionUserId) {
      await this.#load();
    }
  }

  /**
   * Clear the in-memory list, user id and error (logout).
   *
   * @returns {void} Nothing.
   */
  clear() {
    this.#sessionUserId = null;
    this.#generation += 1;
    this.#setState(EMPTY_ORG_STATE);
  }

  /**
   * Fetch the list and publish the resulting state, unless the session changed meanwhile.
   *
   * @returns {Promise<object|null>} The published state, or `null` when nothing was published.
   */
  async #load() {
    const generation = this.#generation;
    const userId = this.#sessionUserId;
    const state = await this.#fetchState(userId);

    if (generation !== this.#generation) {
      return null;
    }

    if (!state) {
      this.#sessionUserId = null;
      return null;
    }

    this.#setState(state);

    return state;
  }

  /**
   * Fetch the list into an org-list state.
   *
   * @param {number} userId - The session user id.
   * @returns {Promise<object|null>} The loaded or failed state, or `null` on session expiry.
   */
  async #fetchState(userId) {
    try {
      const orgs = await this.#client.list();

      return {
        userId, orgs, orgsLoaded: true, orgsError: null,
      };
    } catch (error) {
      if (isSessionExpired(error)) {
        return null;
      }

      return {
        userId, orgs: [], orgsLoaded: true, orgsError: error.message || 'Request failed',
      };
    }
  }
}

/**
 * Build the org-list effect: subscribes the controller to the shared `AuthEvents` bus and
 * returns a cleanup that unsubscribes. Exported so specs can run it without a React renderer.
 *
 * @param {OrgListController} controller - The org-list controller.
 * @param {typeof AuthEvents} [events] - Auth event bus override, for testability.
 * @returns {Function} Effect callback, returning a cleanup function.
 */
export function buildOrgListEffect(controller, events = AuthEvents) {
  return () => {
    const handleAuthChanged = (event) => controller.handleAuthChanged(event);

    events.subscribe(handleAuthChanged);

    return () => events.unsubscribe(handleAuthChanged);
  };
}
