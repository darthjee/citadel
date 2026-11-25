import { createInMemoryRepo } from './in-memory-repo.js';
import { OrganizationMembership } from '../../entities/organization-membership.entity.js';
import { Organization } from '../../entities/organization.entity.js';

type InMemoryRepo<T extends { id?: number }> = ReturnType<typeof createInMemoryRepo<T>>;

export type InMemoryOrganizationRepo = Omit<InMemoryRepo<Organization>, 'manager'> & OrganizationRepoExtras;
export type InMemoryMembershipRepo = Omit<InMemoryRepo<OrganizationMembership>, 'manager'> & OrganizationRepoExtras;

interface OrganizationRepoExtras {
  manager: { transaction: <R>(callback: (manager: FakeManager) => Promise<R>) => Promise<R> };
}

interface FakeManager {
  getRepository: (entity: unknown) => unknown;
}

// Adds what `OrganizationService` needs on top of `createInMemoryRepo()`:
// `save` stamps `updatedAt` on every save (and `createdAt` on insert), like
// TypeORM's `@CreateDateColumn`/`@UpdateDateColumn`, so serialized
// organizations always carry both timestamps. `findRole` goes through the base
// `findOne({ where, select })` (the fake ignores `select`).
function withOrganizationExtras<T extends { id?: number; createdAt?: Date; updatedAt?: Date }>(
  repo: InMemoryRepo<T>,
): InMemoryRepo<T> {
  const save = async (entity: T): Promise<T> => {
    const now = new Date();
    entity.createdAt ??= now;
    entity.updatedAt = now;
    return repo.save(entity);
  };

  return { ...repo, save };
}

// Builds the in-memory `Organization` and `OrganizationMembership` repos sharing
// one fake `manager`: `transaction(cb)` runs `cb` with a manager whose
// `getRepository(Entity)` returns the matching in-memory repo. Like the other
// fake managers it is **not** a real transaction (no isolation); it only
// mimics a rollback by dropping the rows inserted while the callback ran when it throws.
export function createInMemoryOrganizationRepos(): {
  organizationRepo: InMemoryOrganizationRepo;
  membershipRepo: InMemoryMembershipRepo;
  } {
  const organizationRepo = withOrganizationExtras(createInMemoryRepo<Organization>()) as InMemoryOrganizationRepo;
  const membershipRepo = withOrganizationExtras(
    createInMemoryRepo<OrganizationMembership>(),
  ) as InMemoryMembershipRepo;

  const manager = {
    transaction: async <R>(callback: (fake: FakeManager) => Promise<R>): Promise<R> => {
      const organizationCount = organizationRepo.rows.length;
      const membershipCount = membershipRepo.rows.length;

      try {
        return await callback({
          getRepository: (entity: unknown) => (entity === Organization ? organizationRepo : membershipRepo),
        });
      } catch (error) {
        organizationRepo.rows.splice(organizationCount);
        membershipRepo.rows.splice(membershipCount);
        throw error;
      }
    },
  };

  organizationRepo.manager = manager;
  membershipRepo.manager = manager;

  return { organizationRepo, membershipRepo };
}
