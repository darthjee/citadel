import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ownerNotFound } from '../../core/parse-org-id.js';
import { MembershipRole, type OrganizationMembership } from '../entities/organization-membership.entity.js';
import { OrganizationService } from '../organization.service.js';
import { createInMemoryOrganizationRepos } from './support/in-memory-organization-repos.js';

describe('OrganizationService', () => {
  let repos: ReturnType<typeof createInMemoryOrganizationRepos>;
  let service: OrganizationService;

  beforeEach(() => {
    repos = createInMemoryOrganizationRepos();
    service = new OrganizationService(repos.organizationRepo as never, repos.membershipRepo as never);
  });

  describe('create', () => {
    it('saves the organization and makes the creator its owner', async () => {
      const { organization, role } = await service.create(7, 'Family');

      expect(role).toBe(MembershipRole.OWNER);
      expect(organization).toMatchObject({ id: 1, name: 'Family' });
      expect(organization.createdAt).toBeInstanceOf(Date);
      expect(organization.updatedAt).toBeInstanceOf(Date);
      expect(repos.membershipRepo.rows).toEqual([
        expect.objectContaining({ organizationId: 1, userId: 7, role: MembershipRole.OWNER }),
      ]);
    });

    it('rolls the organization back when the membership cannot be saved', async () => {
      jest.spyOn(repos.membershipRepo, 'save').mockRejectedValueOnce(new Error('boom'));

      await expect(service.create(7, 'Family')).rejects.toThrow('boom');
      expect(repos.organizationRepo.rows).toEqual([]);
      expect(repos.membershipRepo.rows).toEqual([]);
    });
  });

  describe('findRole', () => {
    beforeEach(async () => {
      await service.create(7, 'Family');
    });

    it('returns the role of a member', async () => {
      await expect(service.findRole(7, 1)).resolves.toBe(MembershipRole.OWNER);
    });

    it.each([MembershipRole.ADMIN, MembershipRole.USER])('returns the seeded %p role', async (role) => {
      repos.membershipRepo.rows.push({ id: 50, organizationId: 1, userId: 8, role } as OrganizationMembership);

      await expect(service.findRole(8, 1)).resolves.toBe(role);
    });

    it('is null for a non-member', async () => {
      await expect(service.findRole(8, 1)).resolves.toBeNull();
    });

    it('is null for an unknown organization, with the same single lookup', async () => {
      const findOne = jest.spyOn(repos.membershipRepo, 'findOne');
      const findOrganization = jest.spyOn(repos.organizationRepo, 'findOneBy');

      await expect(service.findRole(7, 99)).resolves.toBeNull();
      expect(findOne).toHaveBeenCalledTimes(1);
      expect(findOne).toHaveBeenCalledWith({ where: { organizationId: 99, userId: 7 }, select: { role: true } });
      expect(findOrganization).not.toHaveBeenCalled();
    });
  });

  describe('findMembership', () => {
    beforeEach(async () => {
      await service.create(7, 'Family');
    });

    it('returns the membership and organization for a member', async () => {
      const found = await service.findMembership(7, 1);

      expect(found?.organization).toMatchObject({ id: 1, name: 'Family' });
      expect(found?.membership).toMatchObject({ organizationId: 1, userId: 7, role: MembershipRole.OWNER });
    });

    it('returns null for a non-member', async () => {
      await expect(service.findMembership(8, 1)).resolves.toBeNull();
    });

    it('returns null for an unknown organization', async () => {
      await expect(service.findMembership(7, 99)).resolves.toBeNull();
    });

    it('returns null when the membership points at a missing organization', async () => {
      repos.organizationRepo.rows.splice(0);

      await expect(service.findMembership(7, 1)).resolves.toBeNull();
    });
  });

  describe('listForUser', () => {
    it('returns an empty list for a user with zero organizations', async () => {
      await expect(service.listForUser(7)).resolves.toEqual([]);
    });

    it("lists only the user's organizations, ordered by id, with their role", async () => {
      await service.create(7, 'First');
      await service.create(8, 'Other');
      await service.create(7, 'Second');
      repos.membershipRepo.rows.reverse();

      const listed = await service.listForUser(7);

      expect(listed.map(({ organization, role }) => [organization.id, organization.name, role])).toEqual([
        [1, 'First', MembershipRole.OWNER],
        [3, 'Second', MembershipRole.OWNER],
      ]);
    });
  });

  describe('rename', () => {
    beforeEach(async () => {
      await service.create(7, 'Family');
    });

    it('renames the organization for a member and returns their role', async () => {
      const { organization, role } = await service.rename(7, 1, 'Household');

      expect(organization).toMatchObject({ id: 1, name: 'Household' });
      expect(role).toBe(MembershipRole.OWNER);
      expect(repos.organizationRepo.rows[0].name).toBe('Household');
    });

    it('throws the uniform 404 for a non-member, leaving the name unchanged', async () => {
      const error = await service.rename(8, 1, 'Hijacked').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
      expect(repos.organizationRepo.rows[0].name).toBe('Family');
    });

    it('throws the uniform 404 for an unknown organization', async () => {
      await expect(service.rename(7, 99, 'Ghost')).rejects.toThrow(NotFoundException);
    });

    describe('by role', () => {
      const seed = (userId: number, role: MembershipRole): void => {
        repos.membershipRepo.rows.push({ id: 50 + userId, organizationId: 1, userId, role } as OrganizationMembership);
      };

      it('forbids a user with the uniform 403, saving nothing', async () => {
        seed(8, MembershipRole.USER);
        const save = jest.spyOn(repos.organizationRepo, 'save');
        const error = await service.rename(8, 1, 'Hijacked').catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toEqual({ statusCode: 403, message: 'Forbidden' });
        expect(save).not.toHaveBeenCalled();
        expect(repos.organizationRepo.rows[0].name).toBe('Family');
      });

      it('renames for an admin, returning the admin role', async () => {
        seed(8, MembershipRole.ADMIN);

        const { organization, role } = await service.rename(8, 1, 'Household');

        expect(organization.name).toBe('Household');
        expect(role).toBe(MembershipRole.ADMIN);
      });
    });
  });
});
