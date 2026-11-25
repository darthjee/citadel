import request from 'supertest';
import {
  createOrganization,
  loginCookie,
  ORGANIZATION_KEYS,
  SETUP_TIMEOUT_MS,
  registerUser,
  useOrganizationTestApp,
} from './organization.controller.e2e-test-support.js';
import { expectValidationErrorBody } from './support/error-body.js';

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('OrganizationController (e2e) — POST /orgs.json', () => {
  // One app per file (bcrypt-heavy setup); every test starts with no organization.
  const ctx = useOrganizationTestApp({ perFile: true });
  let cookie: string;

  beforeAll(async () => {
    cookie = await loginCookie(ctx.current.app);
  }, SETUP_TIMEOUT_MS);

  beforeEach(() => {
    ctx.current.organizationRepo.rows.splice(0);
    ctx.current.membershipRepo.rows.splice(0);
  });

  describe('registration', () => {
    it('creates the user only: no organization and no membership', async () => {
      await registerUser(ctx.current.app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);

      expect(ctx.current.userRepo.rows).toHaveLength(2);
      expect(ctx.current.organizationRepo.rows).toEqual([]);
      expect(ctx.current.membershipRepo.rows).toEqual([]);
    });
  });

  describe('with a valid name', () => {
    it('creates the organization and makes the requester its owner', async () => {
      const response = await createOrganization(ctx.current.app, cookie, { name: 'Family' }).expect(201);
      const userId = ctx.current.userRepo.rows[0].id;

      expect(response.body).toEqual({
        id: expect.any(Number),
        name: 'Family',
        role: 'owner',
        created_at: expect.stringMatching(ISO_TIMESTAMP),
        updated_at: expect.stringMatching(ISO_TIMESTAMP),
      });
      expect(ctx.current.membershipRepo.rows).toEqual([
        expect.objectContaining({ organizationId: response.body.id, userId, role: 'owner' }),
      ]);
    });

    it('answers exactly id, name, role, created_at and updated_at', async () => {
      const response = await createOrganization(ctx.current.app, cookie, { name: 'Family' }).expect(201);

      expect(Object.keys(response.body).sort()).toEqual(ORGANIZATION_KEYS);
    });

    it('trims the name', async () => {
      const response = await createOrganization(ctx.current.app, cookie, { name: '  Family \t' }).expect(201);

      expect(response.body.name).toBe('Family');
      expect(ctx.current.organizationRepo.rows[0].name).toBe('Family');
    });

    it('accepts exactly 255 characters', async () => {
      const name = 'a'.repeat(255);
      const response = await createOrganization(ctx.current.app, cookie, { name }).expect(201);

      expect(response.body.name).toBe(name);
    });

    it('allows duplicate names', async () => {
      const first = await createOrganization(ctx.current.app, cookie, { name: 'Family' }).expect(201);
      const second = await createOrganization(ctx.current.app, cookie, { name: 'Family' }).expect(201);

      expect(second.body.id).toBe(first.body.id + 1);
      expect(ctx.current.organizationRepo.rows).toHaveLength(2);
    });

    it('is never cached', async () => {
      const response = await createOrganization(ctx.current.app, cookie, { name: 'Family' }).expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('invalidates only the organization list', async () => {
      const response = await createOrganization(ctx.current.app, cookie, { name: 'Family' }).expect(201);

      expect(response.headers['x-cache-invalidate']).toBe('/orgs.json');
    });
  });

  describe('with an invalid body', () => {
    it.each([
      ['an empty name', { name: '' }],
      ['a whitespace-only name', { name: '   ' }],
      ['a 256-character name', { name: 'a'.repeat(256) }],
      ['a name with a NUL character', { name: 'Fam\u0000ily' }],
      ['a non-string name', { name: 42 }],
      ['no name', {}],
      ['a role', { name: 'Family', role: 'admin' }],
      ['an organizationId', { name: 'Family', organizationId: 9 }],
    ])('answers 400 for %s, creating nothing', async (_label, body) => {
      const response = await createOrganization(ctx.current.app, cookie, body);

      expectValidationErrorBody(response);
      expect(ctx.current.organizationRepo.rows).toEqual([]);
      expect(ctx.current.membershipRepo.rows).toEqual([]);
    });

    it('names the forbidden field', async () => {
      const response = await createOrganization(ctx.current.app, cookie, { name: 'Family', role: 'admin' });

      expect(response.body.error.details).toEqual(['property role should not exist']);
    });
  });

  describe('without authentication', () => {
    it('answers 401', async () => {
      await request(ctx.current.app.getHttpServer()).post('/orgs.json').send({ name: 'Family' }).expect(401);
      expect(ctx.current.organizationRepo.rows).toEqual([]);
    });
  });
});
