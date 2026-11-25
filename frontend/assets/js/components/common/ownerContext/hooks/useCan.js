import useOwnerContext from './useOwnerContext.js';
import { can } from '../../../../utils/permissions/orgPermissions.js';

/**
 * Tell whether the caller's role in the active context allows an action.
 *
 * @description Reads `role` from the owner context and delegates to {@link can}; a role that
 * is not yet known (`null`) allows nothing.
 * @param {string} action - One of the `ACTIONS` constants.
 * @returns {boolean} `true` when the action is allowed.
 */
export default function useCan(action) {
  return can(useOwnerContext().role, action);
}
