import { MembershipRole } from '../entities/organization-membership.entity.js';
import type { Organization } from '../entities/organization.entity.js';
import { serializeOrganization } from '../organization-response.js';

describe('serializeOrganization', () => {
  const createdAt = new Date('2026-11-01T10:00:00Z');
  const updatedAt = new Date('2026-11-02T10:00:00Z');
  const organization = {
    id: 3,
    name: 'Family',
    createdAt,
    updatedAt,
    extra: 'never exposed',
  } as unknown as Organization;

  it('returns exactly id, name, role, created_at and updated_at', () => {
    const serialized = serializeOrganization(organization, MembershipRole.OWNER);

    expect(Object.keys(serialized).sort()).toEqual(['created_at', 'id', 'name', 'role', 'updated_at']);
    expect(serialized).toEqual({ id: 3, name: 'Family', role: 'owner', created_at: createdAt, updated_at: updatedAt });
  });
});
