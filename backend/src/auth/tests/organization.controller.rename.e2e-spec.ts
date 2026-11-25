import {
  createOrganization,
  loginCookie,
  MALFORMED_ORG_IDS,
  registerAndLogin,
  renameOrganization,
  SETUP_TIMEOUT_MS,
  useOrganizationTestApp,
  withoutTimestamp,
} from './organization.controller.e2e-test-support.js';
import { MembershipRole, type OrganizationMembership } from '../entities/organization-membership.entity.js';
import { expectValidationErrorBody } from './support/error-body.js';

const UNIFORM_404 = { error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404 };
const UNIFORM_403 = { error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode: 403 };

// Renaming an organization needs `admin` or `owner` (#143). The order is 400 body → 404 membership →
// 403 role. Memberships are seeded straight into the fake repository (joining arrives in #82).
describe('OrganizationController (e2e) — rename by role', () => {
  const ctx = useOrganizationTestApp({ perFile: true });
  let owner: string;
  const cookies: Record<string, string> = {};

  const userIdOf = (username: string): number => ctx.current.userRepo.rows.find((user) => user.username === username)!.id;
  const nameOf = (): string => ctx.current.organizationRepo.rows[0].name;

  beforeAll(async () => {
    owner = await loginCookie(ctx.current.app);
    await createOrganization(ctx.current.app, owner, { name: 'Family' }).expect(201);

    for (const [username, role] of [['han', MembershipRole.ADMIN], ['luke', MembershipRole.USER]] as const) {
      cookies[role] = await registerAndLogin(ctx.current.app, username);
      ctx.current.membershipRepo.rows.push({
        id: ctx.current.membershipRepo.rows.length + 1,
        organizationId: 1,
        userId: userIdOf(username),
        role,
      } as OrganizationMembership);
    }

    cookies.outsider = await registerAndLogin(ctx.current.app, 'leia');
  }, SETUP_TIMEOUT_MS);

  afterEach(() => {
    ctx.current.organizationRepo.rows[0].name = 'Family';
  });

  it('answers the uniform 403 to a user, leaving the name unchanged', async () => {
    const response = await renameOrganization(ctx.current.app, cookies[MembershipRole.USER], 1, { name: 'Hijacked' }).expect(403);

    expect(withoutTimestamp(response)).toEqual(UNIFORM_403);
    expect(nameOf()).toBe('Family');
  });

  it('renames for an admin, answering the admin role', async () => {
    const response = await renameOrganization(ctx.current.app, cookies[MembershipRole.ADMIN], 1, { name: 'Household' }).expect(200);

    expect(response.body).toMatchObject({ id: 1, name: 'Household', role: MembershipRole.ADMIN });
    expect(nameOf()).toBe('Household');
  });

  it('renames for the owner', async () => {
    const response = await renameOrganization(ctx.current.app, owner, 1, { name: 'Household' }).expect(200);

    expect(response.body).toMatchObject({ id: 1, name: 'Household', role: MembershipRole.OWNER });
  });

  it('answers the uniform 404 to a non-member', async () => {
    const response = await renameOrganization(ctx.current.app, cookies.outsider, 1, { name: 'Hijacked' }).expect(404);

    expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    expect(nameOf()).toBe('Family');
  });

  it.each(MALFORMED_ORG_IDS)('answers the uniform 404 to a user for the malformed id %p', async (orgId) => {
    const response = await renameOrganization(ctx.current.app, cookies[MembershipRole.USER], orgId, { name: 'X' }).expect(404);

    expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
  });

  it('answers 400 to a user for an invalid body, before the role check', async () => {
    const response = await renameOrganization(ctx.current.app, cookies[MembershipRole.USER], 1, { name: '' });

    expectValidationErrorBody(response);
    expect(nameOf()).toBe('Family');
  });
});
