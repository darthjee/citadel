import { isSessionExpired } from '../../../../../client/isSessionExpired.js';
import OrganizationsClient from '../../../../../client/OrganizationsClient.js';

/**
 * Loads one organization for the overview and edit pages.
 *
 * @description A `404` (identical for unknown, malformed and non-member ids) reports Not-found;
 * other failures report their message. A session-expired rejection reports nothing.
 * Answers arriving after `isActive()` turned false are ignored.
 */
export default class OrganizationLoader {
  #client;

  /**
   * Create a loader.
   *
   * @param {typeof OrganizationsClient} [client] - HTTP client override, for testability.
   */
  constructor(client = OrganizationsClient) {
    this.#client = client;
  }

  /**
   * Fetch the organization and report the outcome.
   *
   * @param {number} orgId - The organization id, from the validated active context.
   * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
   *   callbacks (`onError` receives the error message).
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(orgId, { onLoaded, onNotFound, onError }, isActive = () => true) {
    try {
      const org = await this.#client.show(orgId);

      if (isActive()) {
        onLoaded(org);
      }
    } catch (error) {
      if (!isActive() || isSessionExpired(error)) {
        return;
      }

      if (error.status === 404) {
        onNotFound();
        return;
      }

      onError(error.message);
    }
  }
}

/**
 * Build the load-on-visit effect of an organization page. Exported so specs can run it without
 * a React renderer.
 *
 * @param {OrganizationLoader} loader - The loader.
 * @param {number} orgId - The organization id.
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
 *   callbacks.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildOrganizationLoadEffect(loader, orgId, callbacks) {
  return () => {
    let active = true;

    loader.load(orgId, callbacks, () => active);

    return () => {
      active = false;
    };
  };
}
