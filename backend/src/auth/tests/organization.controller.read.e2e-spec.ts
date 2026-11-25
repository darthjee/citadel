import request from 'supertest';
import {
  createOrganization,
  loginCookie,
  ORGANIZATION_KEYS,
  registerAndLogin,
  SETUP_TIMEOUT_MS,
  renameOrganization,
  showOrganization,
  useOrganizationTestApp,
} from './organization.controller.e2e-test-support.js';
import { expectValidationErrorBody } from './support/error-body.js';

describe('OrganizationController (e2e) — reading and renaming', () => {
  // One app per file (bcrypt-heavy setup): darthjee owns Family (1) and Work (3), leia owns
  // Rebellion (2), han has none. Renames are undone after each test.
  const ctx = useOrganizationTestApp({ perFile: true });
  let cookie: string;
  let han: string;

  beforeAll(async () => {
    cookie = await loginCookie(ctx.current.app);
    const leia = await registerAndLogin(ctx.current.app, 'leia');
    han = await registerAndLogin(ctx.current.app, 'han');
    await createOrganization(ctx.current.app, cookie, { name: 'Family' }).expect(201);
    await createOrganization(ctx.current.app, leia, { name: 'Rebellion' }).expect(201);
    await createOrganization(ctx.current.app, cookie, { name: 'Work' }).expect(201);
  }, SETUP_TIMEOUT_MS);

  afterEach(() => {
    ctx.current.organizationRepo.rows[0].name = 'Family';
  });

  describe('GET /orgs.json', () => {
    it("lists only the caller's organizations, with their role", async () => {
      const response = await request(ctx.current.app.getHttpServer())
        .get('/orgs.json')
        .set('Cookie', [cookie])
        .expect(200);

      expect(response.body.map(({ id, name, role }: Record<string, unknown>) => ({ id, name, role }))).toEqual([
        { id: 1, name: 'Family', role: 'owner' },
        { id: 3, name: 'Work', role: 'owner' },
      ]);
      response.body.forEach((organization: object) => {
        expect(Object.keys(organization).sort()).toEqual(ORGANIZATION_KEYS);
      });
    });

    it('answers an empty list for a user with zero organizations', async () => {
      const response = await request(ctx.current.app.getHttpServer())
        .get('/orgs.json')
        .set('Cookie', [han])
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('is user-scoped: X-Skip-Cache with a private Cache-Control', async () => {
      const response = await request(ctx.current.app.getHttpServer()).get('/orgs.json').set('Cookie', [cookie]);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it('answers 401 without authentication', async () => {
      await request(ctx.current.app.getHttpServer()).get('/orgs.json').expect(401);
    });
  });

  describe('GET /orgs/:orgId.json', () => {
    it('shows the organization to a member, with exactly the public keys', async () => {
      const response = await showOrganization(ctx.current.app, cookie, 1).expect(200);

      expect(response.body).toMatchObject({ id: 1, name: 'Family', role: 'owner' });
      expect(Object.keys(response.body).sort()).toEqual(ORGANIZATION_KEYS);
    });

    it('is user-scoped: X-Skip-Cache with a private Cache-Control', async () => {
      const response = await showOrganization(ctx.current.app, cookie, 1);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it('answers 401 without authentication', async () => {
      await request(ctx.current.app.getHttpServer()).get('/orgs/1.json').expect(401);
    });
  });

  describe('PATCH /orgs/:orgId.json', () => {
    it('renames the organization (trimmed), with exactly the public keys', async () => {
      const response = await renameOrganization(ctx.current.app, cookie, 1, { name: ' Household ' }).expect(200);

      expect(response.body).toMatchObject({ id: 1, name: 'Household', role: 'owner' });
      expect(Object.keys(response.body).sort()).toEqual(ORGANIZATION_KEYS);
      expect(ctx.current.organizationRepo.rows[0].name).toBe('Household');
    });

    it('is never cached', async () => {
      const response = await renameOrganization(ctx.current.app, cookie, 1, { name: 'Household' });

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('invalidates the organization list and the renamed organization, never /orgs', async () => {
      const response = await renameOrganization(ctx.current.app, cookie, 1, { name: 'Household' }).expect(200);

      expect(response.headers['x-cache-invalidate']).toBe('/orgs.json, /orgs/1.json');
    });

    it.each([
      ['no name', {}],
      ['an empty name', { name: '' }],
      ['a whitespace-only name', { name: ' \n ' }],
      ['a 256-character name', { name: 'a'.repeat(256) }],
      ['a name with a NUL character', { name: 'House\u0000hold' }],
      ['an unknown field', { name: 'Household', color: 'red' }],
      ['a role', { name: 'Household', role: 'user' }],
      ['an organizationId', { name: 'Household', organizationId: 2 }],
    ])('answers 400 for %s, leaving the name unchanged', async (_label, body) => {
      const response = await renameOrganization(ctx.current.app, cookie, 1, body);

      expectValidationErrorBody(response);
      expect(ctx.current.organizationRepo.rows[0].name).toBe('Family');
      expect(ctx.current.membershipRepo.rows[0].role).toBe('owner');
    });

    it('answers 401 without authentication', async () => {
      await request(ctx.current.app.getHttpServer()).patch('/orgs/1.json').send({ name: 'Household' }).expect(401);
      expect(ctx.current.organizationRepo.rows[0].name).toBe('Family');
    });
  });
});
