import { Injectable } from '@nestjs/common';
import type { OrgRole } from './org-role.js';
import type { OrganizationMembershipLookup } from './organization-membership-lookup.js';

/**
 * Fail-closed default {@link OrganizationMembershipLookup}: nobody is a member
 * of any organization. It keeps the app bootable while no organizations
 * backend exists — `OwnerContextGuard` needs an
 * `ORGANIZATION_MEMBERSHIP_LOOKUP` provider — and makes every
 * `/orgs/:orgId/...` route answer the uniform 404.
 *
 * Bound in `AppModule` until the organizations backend (#28) replaces the
 * binding with `OrganizationService` (`useExisting` in `AuthModule`); this
 * class may then be deleted or kept for tests.
 */
@Injectable()
export class NoOrganizationMembershipLookup implements OrganizationMembershipLookup {
  /**
   * Answers that the user is not a member, whatever the organization.
   * @param {number} _userId - The authenticated user's id (ignored).
   * @param {number} _orgId - The organization id (ignored).
   * @returns {Promise<OrgRole | null>} Always `null`.
   */
  findRole(_userId: number, _orgId: number): Promise<OrgRole | null> {
    return Promise.resolve(null);
  }
}
