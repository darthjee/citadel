import { can } from '../../../../../utils/permissions/orgPermissions.js';

/**
 * Tell whether a role may use a role-gated page.
 *
 * @param {string|null} role - The caller's role in the active context.
 * @param {string} action - One of the `ACTIONS` constants.
 * @returns {boolean|null} `null` while the role is unknown, otherwise whether it allows `action`.
 */
export default function roleGate(role, action) {
  return role === null ? null : can(role, action);
}
