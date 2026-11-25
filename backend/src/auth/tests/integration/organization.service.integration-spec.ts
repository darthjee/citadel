import { randomUUID } from 'node:crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from '../../../database/tests/integration/test-data-source.js';
import { MembershipRole, OrganizationMembership } from '../../entities/organization-membership.entity.js';
import { Organization } from '../../entities/organization.entity.js';
import { User, UserStatus } from '../../entities/user.entity.js';
import { OrganizationService } from '../../organization.service.js';

describe('OrganizationService (MySQL)', () => {
  let ds: DataSource;
  let users: Repository<User>;
  let organizations: Repository<Organization>;
  let memberships: Repository<OrganizationMembership>;
  let service: OrganizationService;

  beforeAll(async () => {
    ds = await createTestDataSource();
    await resetDatabase(ds);
    await ds.runMigrations();

    users = ds.getRepository(User);
    organizations = ds.getRepository(Organization);
    memberships = ds.getRepository(OrganizationMembership);
    service = new OrganizationService(organizations, memberships);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  /**
   * Inserts an approved user with a unique username.
   *
   * @returns the saved user.
   */
  async function seedUser(): Promise<User> {
    const username = `user-${randomUUID()}`;
    return users.save(users.create({
      username,
      email: `${username}@example.test`,
      passwordDigest: 'digest',
      isAdmin: false,
      status: UserStatus.APPROVED,
    }));
  }

  /**
   * Adds `user` to `organizationId` with `role`, bypassing the service (seeding only).
   *
   * @param organizationId - the organization's id.
   * @param user - the member.
   * @param role - the member's role.
   * @returns the saved membership.
   */
  async function addMember(organizationId: number, user: User, role: MembershipRole): Promise<OrganizationMembership> {
    return memberships.save(memberships.create({ organizationId, userId: user.id, role }));
  }

  describe('create', () => {
    it('writes the organization and exactly one owner membership', async () => {
      const user = await seedUser();

      const { organization, role } = await service.create(user.id, 'Family');

      expect(role).toBe(MembershipRole.OWNER);
      await expect(organizations.findOneBy({ id: organization.id })).resolves.toMatchObject({ name: 'Family' });
      const rows = await memberships.findBy({ organizationId: organization.id });
      expect(rows).toEqual([expect.objectContaining({ userId: user.id, role: MembershipRole.OWNER })]);
      expect(organization.createdAt).toBeInstanceOf(Date);
      expect(organization.updatedAt).toBeInstanceOf(Date);
    });

    it('rolls the organization back when the membership insert fails', async () => {
      const organizationsBefore = await organizations.count();
      const membershipsBefore = await memberships.count();
      const missingUserId = 2_000_000_000;

      await expect(service.create(missingUserId, 'Orphan')).rejects.toThrow(/foreign key constraint/i);

      await expect(organizations.count()).resolves.toBe(organizationsBefore);
      await expect(memberships.count()).resolves.toBe(membershipsBefore);
    });
  });

  describe('reads', () => {
    let owner: User;
    let member: User;
    let outsider: User;
    let first: Organization;
    let second: Organization;

    beforeAll(async () => {
      owner = await seedUser();
      member = await seedUser();
      outsider = await seedUser();
      first = (await service.create(owner.id, 'First')).organization;
      second = (await service.create(member.id, 'Second')).organization;
      await addMember(first.id, member, MembershipRole.ADMIN);
    });

    it('lists the user organizations ordered by id, with their roles', async () => {
      const list = await service.listForUser(member.id);

      expect(list.map(({ organization, role }) => [organization.id, organization.name, role])).toEqual([
        [first.id, 'First', MembershipRole.ADMIN],
        [second.id, 'Second', MembershipRole.OWNER],
      ]);
    });

    it('lists nothing for a user with zero organizations', async () => {
      await expect(service.listForUser(outsider.id)).resolves.toEqual([]);
    });

    it('finds a membership with its organization', async () => {
      const found = await service.findMembership(member.id, first.id);

      expect(found?.membership).toMatchObject({ organizationId: first.id, userId: member.id, role: MembershipRole.ADMIN });
      expect(found?.organization).toMatchObject({ id: first.id, name: 'First' });
    });

    it('finds no membership for a non-member or an unknown organization', async () => {
      await expect(service.findMembership(outsider.id, first.id)).resolves.toBeNull();
      await expect(service.findMembership(owner.id, 2_000_000_000)).resolves.toBeNull();
    });

    it('resolves the role, or null for a non-member', async () => {
      await expect(service.findRole(owner.id, first.id)).resolves.toBe(MembershipRole.OWNER);
      await expect(service.findRole(member.id, first.id)).resolves.toBe(MembershipRole.ADMIN);
      await expect(service.findRole(outsider.id, first.id)).resolves.toBeNull();
    });
  });

  describe('rename', () => {
    let owner: User;
    let organization: Organization;

    beforeEach(async () => {
      owner = await seedUser();
      organization = (await service.create(owner.id, 'Before')).organization;
    });

    it('persists the new name for an admin or owner', async () => {
      const admin = await seedUser();
      await addMember(organization.id, admin, MembershipRole.ADMIN);

      const renamed = await service.rename(admin.id, organization.id, 'After');

      expect(renamed).toMatchObject({ organization: { id: organization.id, name: 'After' }, role: MembershipRole.ADMIN });
      await expect(organizations.findOneBy({ id: organization.id })).resolves.toMatchObject({ name: 'After' });
    });

    it('answers the uniform 404 to a non-member, leaving the name unchanged', async () => {
      const outsider = await seedUser();

      await expect(service.rename(outsider.id, organization.id, 'After')).rejects.toBeInstanceOf(NotFoundException);
      await expect(organizations.findOneBy({ id: organization.id })).resolves.toMatchObject({ name: 'Before' });
    });

    it('answers the uniform 403 to a user-role member, leaving the name unchanged', async () => {
      const plain = await seedUser();
      await addMember(organization.id, plain, MembershipRole.USER);

      await expect(service.rename(plain.id, organization.id, 'After')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(organizations.findOneBy({ id: organization.id })).resolves.toMatchObject({ name: 'Before' });
    });
  });

  describe('constraints', () => {
    let owner: User;
    let organization: Organization;

    beforeEach(async () => {
      owner = await seedUser();
      organization = (await service.create(owner.id, 'Constrained')).organization;
    });

    it('rejects a second membership for the same (organization, user) pair', async () => {
      await expect(addMember(organization.id, owner, MembershipRole.USER)).rejects.toThrow(/duplicate entry/i);
      await expect(memberships.countBy({ organizationId: organization.id, userId: owner.id })).resolves.toBe(1);
    });

    it('restricts deleting a user that still has a membership', async () => {
      await expect(users.delete(owner.id)).rejects.toThrow(/foreign key constraint/i);
      await expect(users.existsBy({ id: owner.id })).resolves.toBe(true);
    });

    it('restricts deleting an organization that still has a membership', async () => {
      await expect(organizations.delete(organization.id)).rejects.toThrow(/foreign key constraint/i);
      await expect(organizations.existsBy({ id: organization.id })).resolves.toBe(true);
    });

    it('allows deleting both once the memberships are gone', async () => {
      await memberships.delete({ organizationId: organization.id });

      await organizations.delete(organization.id);
      await users.delete(owner.id);

      await expect(organizations.existsBy({ id: organization.id })).resolves.toBe(false);
      await expect(users.existsBy({ id: owner.id })).resolves.toBe(false);
    });
  });
});
