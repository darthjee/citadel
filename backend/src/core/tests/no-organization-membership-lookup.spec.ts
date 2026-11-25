import { NoOrganizationMembershipLookup } from '../no-organization-membership-lookup.js';

describe('NoOrganizationMembershipLookup', () => {
  const lookup = new NoOrganizationMembershipLookup();

  it.each([
    [1, 1],
    [7, 3],
    [2147483647, 2147483647],
  ])('resolves null for user %p in organization %p', async (userId, orgId) => {
    await expect(lookup.findRole(userId, orgId)).resolves.toBeNull();
  });
});
