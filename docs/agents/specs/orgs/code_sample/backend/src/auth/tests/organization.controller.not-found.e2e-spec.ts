import {
  createOrganization,
  loginCookie,
  MALFORMED_ORG_IDS,
  registerAndLogin,
  SETUP_TIMEOUT_MS,
  renameOrganization,
  showOrganization,
  useOrganizationTestApp,
  withoutTimestamp,
} from './organization.controller.e2e-test-support.js';
import { expectValidationErrorBody } from './support/error-body.js';

const UNIFORM_404 = { error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404 };

describe('OrganizationController (e2e) — uniform 404', () => {
  const ctx = useOrganizationTestApp({ perFile: true });
  let owner: string;
  let outsider: string;

  // Users and the organization are set up once per app (bcrypt-heavy); the tests that change state
  // undo it in `afterEach`.
  beforeAll(async () => {
    owner = await loginCookie(ctx.current.app);
    await createOrganization(ctx.current.app, owner, { name: 'Family' }).expect(201);
    outsider = await registerAndLogin(ctx.current.app, 'leia');
  }, SETUP_TIMEOUT_MS);

  afterEach(() => {
    ctx.current.userRepo.rows.find((user) => user.username === 'leia')!.isAdmin = false;
    ctx.current.organizationRepo.rows[0].name = 'Family';
  });

  describe('GET /orgs/:orgId.json', () => {
    it('answers the uniform 404 for an unknown id', async () => {
      const response = await showOrganization(ctx.current.app, owner, 999).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it.each(MALFORMED_ORG_IDS)('answers the same 404 for the malformed id %p', async (orgId) => {
      const response = await showOrganization(ctx.current.app, owner, orgId).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers the same 404 to a non-member', async () => {
      const response = await showOrganization(ctx.current.app, outsider, 1).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers the same 404 to a global admin who is not a member', async () => {
      ctx.current.userRepo.rows.find((user) => user.username === 'leia')!.isAdmin = true;

      const response = await showOrganization(ctx.current.app, outsider, 1).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers the same 404 for a malformed id that would coerce to an existing one', async () => {
      ctx.current.organizationRepo.rows[0].id = 1000;
      ctx.current.membershipRepo.rows[0].organizationId = 1000;

      try {
        await showOrganization(ctx.current.app, owner, 1000).expect(200);
        const response = await showOrganization(ctx.current.app, owner, '1e3').expect(404);

        expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
      } finally {
        ctx.current.organizationRepo.rows[0].id = 1;
        ctx.current.membershipRepo.rows[0].organizationId = 1;
      }
    });
  });

  describe('PATCH /orgs/:orgId.json', () => {
    it('answers the uniform 404 for an unknown id', async () => {
      const response = await renameOrganization(ctx.current.app, owner, 999, { name: 'Ghost' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it.each(MALFORMED_ORG_IDS)('answers the same 404 for the malformed id %p', async (orgId) => {
      const response = await renameOrganization(ctx.current.app, owner, orgId, { name: 'Ghost' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers the same 404 to a non-member, leaving the name unchanged', async () => {
      const response = await renameOrganization(ctx.current.app, outsider, 1, { name: 'Hijacked' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
      expect(response.headers['x-cache-invalidate']).toBeUndefined();
      expect(ctx.current.organizationRepo.rows[0].name).toBe('Family');
    });

    it('answers the same 404 to a global admin who is not a member', async () => {
      ctx.current.userRepo.rows.find((user) => user.username === 'leia')!.isAdmin = true;

      const response = await renameOrganization(ctx.current.app, outsider, 1, { name: 'Hijacked' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
      expect(response.headers['x-cache-invalidate']).toBeUndefined();
      expect(ctx.current.organizationRepo.rows[0].name).toBe('Family');
    });

    // Deliberate: `@StrictBody()` validates the body before the handler parses `:orgId` or checks
    // membership, so an invalid body answers 400 even where a valid one would get the uniform 404.
    // The 400 depends only on the body, never on membership, so it cannot be used to enumerate
    // organizations. `@OwnerScopedController` routes order it the other way (the guard's 404 first).
    describe('with an invalid body (400 before 404)', () => {
      it.each([
        ['a non-member', 'outsider', 1, { name: '' }],
        ['an unknown id', 'owner', 999, { name: 'x', role: 'admin' }],
        ['a malformed id', 'owner', 'abc', { name: 'x', color: 'red' }],
      ] as const)('answers 400 for %s, writing nothing', async (_label, who, orgId, body) => {
        const cookie = who === 'owner' ? owner : outsider;

        const response = await renameOrganization(ctx.current.app, cookie, orgId, body);

        expectValidationErrorBody(response);
        expect(ctx.current.organizationRepo.rows).toHaveLength(1);
        expect(ctx.current.organizationRepo.rows[0].name).toBe('Family');
        expect(ctx.current.membershipRepo.rows).toHaveLength(1);
        expect(ctx.current.membershipRepo.rows[0].role).toBe('owner');
      });
    });
  });
});
