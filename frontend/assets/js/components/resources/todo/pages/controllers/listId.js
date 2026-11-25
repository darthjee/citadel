import Router from '../../../../../utils/routing/Router.js';
import { parseOrgId } from '../../../../../utils/context/ownerContext.js';

/**
 * Read the current browser location hash, SSR/spec-safe.
 *
 * @returns {string} The current `window.location.hash`, or `''` without a `window`.
 */
function currentHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Extract the todo list id from a hash.
 *
 * @description Works both in Personal (`#/todo/lists/:id...`) and under an organization
 * (`#/orgs/<orgId>/todo/lists/:id...`). The id follows the backend's strict integer rule
 * (`^[1-9][0-9]*$`, at most 2147483647), so a malformed id is never sent to the API.
 * @param {string} pattern - The context-relative route pattern, e.g. `/todo/lists/:id/edit`.
 * @param {string} [hash] - The raw hash; defaults to the current location hash.
 * @returns {number|null} The list id, or `null` when absent or malformed.
 */
export default function listIdFrom(pattern, hash = currentHash()) {
  const params = Router.extractContextParams(pattern, hash);

  return parseOrgId(params.id);
}
