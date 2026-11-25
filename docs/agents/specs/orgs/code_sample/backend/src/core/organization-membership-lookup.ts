import type { OrgRole } from './org-role.js';

/**
 * Injection token for the Core-owned organization-membership lookup port.
 * `OwnerContextGuard` depends on it; the Auth module provides the
 * implementation (`OrganizationService`), so `core/` never imports `auth/`.
 */
export const ORGANIZATION_MEMBERSHIP_LOOKUP = Symbol('ORGANIZATION_MEMBERSHIP_LOOKUP');

/**
 * Port resolving a user's role in an organization (`null` when the user is not
 * a member, which the caller answers with the uniform 404). Implementations
 * run one indexed lookup on the unique `(organization_id, user_id)` key, without
 * first checking that the organization exists (identical cost either way, so
 * organizations cannot be enumerated), never cache between requests and never
 * bypass the check for Ward's global admin.
 */
export interface OrganizationMembershipLookup {
  /**
   * Finds `userId`'s role in organization `orgId`, with one indexed lookup on
   * `(organization_id, user_id)`: no existence pre-check, no caching and no
   * admin bypass.
   * @param {number} userId - The authenticated user's id.
   * @param {number} orgId - The organization id, already parsed by `parseOrgId()`.
   * @returns {Promise<OrgRole | null>} The member's role, or `null` when the
   *   user is not a member (or the organization does not exist).
   */
  findRole(userId: number, orgId: number): Promise<OrgRole | null>;
}
