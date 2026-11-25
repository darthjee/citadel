import type { MembershipRole } from './entities/organization-membership.entity.js';
import type { Organization } from './entities/organization.entity.js';

/**
 * The public view of an organization, from the current user's point of view.
 * Never carries member lists or other users' ids.
 */
export interface OrganizationResponse {
  id: number;
  name: string;
  role: MembershipRole;
  created_at: Date;
  updated_at: Date;
}

/**
 * Serializes an {@link Organization} with the current user's role in it into
 * its public view (entities are never returned directly).
 * @param {Organization} organization - The organization to serialize.
 * @param {MembershipRole} role - The current user's role in it.
 * @returns {OrganizationResponse} Exactly `{ id, name, role, created_at, updated_at }`.
 */
export function serializeOrganization(organization: Organization, role: MembershipRole): OrganizationResponse {
  return {
    id: organization.id,
    name: organization.name,
    role,
    created_at: organization.createdAt,
    updated_at: organization.updatedAt,
  };
}
