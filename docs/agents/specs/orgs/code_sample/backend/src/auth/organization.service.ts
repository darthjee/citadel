import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { hasMinRole, OrgRole, orgRoleForbidden } from '../core/org-role.js';
import type { OrganizationMembershipLookup } from '../core/organization-membership-lookup.js';
import { ownerNotFound } from '../core/parse-org-id.js';
import { MembershipRole, OrganizationMembership } from './entities/organization-membership.entity.js';
import { Organization } from './entities/organization.entity.js';

/** An organization together with the current user's role in it. */
export interface MemberOrganization {
  organization: Organization;
  role: MembershipRole;
}

/** A user's membership row together with its organization. */
export interface MembershipWithOrganization {
  membership: OrganizationMembership;
  organization: Organization;
}

/**
 * Organizations and memberships (exported by `AuthModule`: other modules read
 * memberships only through it, never by querying the tables). Also Core's
 * `ORGANIZATION_MEMBERSHIP_LOOKUP` implementation (`findRole`), used by
 * `OwnerContextGuard` to resolve the caller's role.
 *
 * Every lookup is scoped to the caller's own membership: there is no global
 * admin bypass and no caching between requests. A non-member gets the same
 * uniform 404 as an unknown organization. Names are never logged.
 */
@Injectable()
export class OrganizationService implements OrganizationMembershipLookup {
  private readonly organizationRepository: Repository<Organization>;
  private readonly membershipRepository: Repository<OrganizationMembership>;

  /**
   * @param {Repository<Organization>} organizationRepository - The organization repository.
   * @param {Repository<OrganizationMembership>} membershipRepository - The membership repository.
   */
  constructor(
    @InjectRepository(Organization) organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMembership) membershipRepository: Repository<OrganizationMembership>,
  ) {
    this.organizationRepository = organizationRepository;
    this.membershipRepository = membershipRepository;
  }

  /**
   * Resolves the user's role with one lookup on the unique `(organization_id, user_id)`
   * key, without first checking that the organization exists (same cost for an
   * unknown organization, so organizations cannot be enumerated).
   * @param {number} userId - The user's id.
   * @param {number} orgId - The organization's id.
   * @returns {Promise<OrgRole | null>} The member's role, or `null` when the user is not a member.
   */
  async findRole(userId: number, orgId: number): Promise<OrgRole | null> {
    const row = await this.membershipRepository.findOne({
      where: { organizationId: orgId, userId },
      select: { role: true },
    });

    return row?.role ?? null;
  }

  /**
   * Finds the user's membership of an organization, with the organization.
   * @param {number} userId - The user's id.
   * @param {number} orgId - The organization's id.
   * @returns {Promise<MembershipWithOrganization | null>} The membership and organization, or
   *   `null` when the user is not a member (or the organization does not exist).
   */
  async findMembership(userId: number, orgId: number): Promise<MembershipWithOrganization | null> {
    const membership = await this.membershipRepository.findOneBy({ organizationId: orgId, userId });
    const organization = membership && (await this.organizationRepository.findOneBy({ id: orgId }));

    return membership && organization ? { membership, organization } : null;
  }

  /**
   * Lists the user's organizations with their role in each, ordered by organization id.
   * @param {number} userId - The user's id.
   * @returns {Promise<MemberOrganization[]>} The user's organizations (empty for zero organizations).
   */
  async listForUser(userId: number): Promise<MemberOrganization[]> {
    const memberships = await this.membershipRepository.find({ where: { userId } });

    if (memberships.length === 0) {
      return [];
    }

    const organizations = await this.organizationRepository.find({
      where: { id: In(memberships.map((membership) => membership.organizationId)) },
    });
    const roles = new Map(memberships.map((membership) => [membership.organizationId, membership.role]));

    return organizations
      .filter((organization) => roles.has(organization.id))
      .sort((a, b) => a.id - b.id)
      .map((organization) => ({ organization, role: roles.get(organization.id) as MembershipRole }));
  }

  /**
   * Creates an organization and makes the user its `owner`, in one transaction.
   * The role is always `owner`: it is never taken from input.
   * @param {number} userId - The creating user's id.
   * @param {string} name - The validated, trimmed name.
   * @returns {Promise<MemberOrganization>} The new organization with the `owner` role.
   */
  async create(userId: number, name: string): Promise<MemberOrganization> {
    return this.organizationRepository.manager.transaction(async (manager) => {
      const organizations = manager.getRepository(Organization);
      const memberships = manager.getRepository(OrganizationMembership);
      const organization = await organizations.save(organizations.create({ name }));

      await memberships.save(
        memberships.create({ organizationId: organization.id, userId, role: MembershipRole.OWNER }),
      );

      return { organization, role: MembershipRole.OWNER };
    });
  }

  /**
   * Renames an organization the user is an `admin` or `owner` of (last write wins among them).
   * The membership is checked first, so a non-member gets the uniform 404 before a `user` gets
   * the uniform 403.
   * @param {number} userId - The user's id.
   * @param {number} orgId - The organization's id.
   * @param {string} name - The validated, trimmed new name.
   * @returns {Promise<MemberOrganization>} The renamed organization with the user's role.
   * @throws {NotFoundException} The uniform 404 when the user is not a member.
   * @throws {ForbiddenException} The uniform 403 when the member's role is below `admin`.
   */
  async rename(userId: number, orgId: number, name: string): Promise<MemberOrganization> {
    const found = await this.findMembership(userId, orgId);

    if (!found) {
      throw ownerNotFound();
    }

    if (!hasMinRole(found.membership.role, OrgRole.ADMIN)) {
      throw orgRoleForbidden();
    }

    found.organization.name = name;
    const organization = await this.organizationRepository.save(found.organization);

    return { organization, role: found.membership.role };
  }
}
