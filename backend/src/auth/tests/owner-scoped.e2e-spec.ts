import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createOrganization,
  MALFORMED_ORG_IDS,
  registerAndLogin,
  SETUP_TIMEOUT_MS,
  withoutTimestamp,
} from './organization.controller.e2e-test-support.js';
import { WidgetsTestController } from './owner-scoped.e2e-test-support.js';
import { loginCookie } from './support/auth-requests.js';
import { buildAuthTestApp, type BuildAuthTestAppResult } from './support/build-auth-test-app.js';
import { expectValidationErrorBody } from './support/error-body.js';

const UNIFORM_404 = { error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404 };

function getOwner(app: INestApplication, cookie: string, prefix: string): request.Test {
  return request(app.getHttpServer()).get(`${prefix}/widgets/owner.json`).set('Cookie', [cookie]);
}

function postEcho(app: INestApplication, cookie: string, prefix: string, body: object): request.Test {
  return request(app.getHttpServer()).post(`${prefix}/widgets/echo.json`).set('Cookie', [cookie]).send(body);
}

describe('@OwnerScopedController (e2e)', () => {
  let current: BuildAuthTestAppResult;
  let owner: string;
  let outsider: string;
  let ownerId: number;
  const removedMemberships: BuildAuthTestAppResult['membershipRepo']['rows'] = [];

  // Built once per file (bcrypt-heavy setup); the tests that change state undo it in `afterEach`.
  beforeAll(async () => {
    current = await buildAuthTestApp({ adminGuard: true, ownerContextGuard: true, controllers: [WidgetsTestController] });
    owner = await loginCookie(current.app);
    ownerId = current.userRepo.rows[0].id;
    await createOrganization(current.app, owner, { name: 'Family' }).expect(201);
    outsider = await registerAndLogin(current.app, 'leia');
  }, SETUP_TIMEOUT_MS);

  afterEach(() => {
    current.userRepo.rows[1].isAdmin = false;

    if (current.membershipRepo.rows.length === 0) {
      current.membershipRepo.rows.push(...removedMemberships);
    }
  });

  afterAll(async () => {
    await current.app.close();
  });

  describe('on the personal prefix', () => {
    it('resolves the JWT user as owner', async () => {
      const response = await getOwner(current.app, owner, '').expect(200);

      expect(response.body).toEqual({ kind: 'user', userId: ownerId });
    });

    it('resolves each caller to themselves', async () => {
      const response = await getOwner(current.app, outsider, '').expect(200);

      expect(response.body).toEqual({ kind: 'user', userId: current.userRepo.rows[1].id });
    });

    it('is user-scoped: X-Skip-Cache with a private Cache-Control', async () => {
      const response = await getOwner(current.app, owner, '');

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it('answers 401 without authentication', async () => {
      await request(current.app.getHttpServer()).get('/widgets/owner.json').expect(401);
    });
  });

  describe('on the organization prefix', () => {
    it('resolves the organization as owner for a member', async () => {
      const response = await getOwner(current.app, owner, '/orgs/1').expect(200);

      expect(response.body).toEqual({ kind: 'organization', organizationId: 1, role: 'owner' });
    });

    it('is user-scoped: X-Skip-Cache with a private Cache-Control', async () => {
      const response = await getOwner(current.app, owner, '/orgs/1');

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it('checks membership on every request', async () => {
      await getOwner(current.app, owner, '/orgs/1').expect(200);
      removedMemberships.splice(0, removedMemberships.length, ...current.membershipRepo.rows.splice(0));

      const response = await getOwner(current.app, owner, '/orgs/1').expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers the uniform 404 for an unknown id', async () => {
      const response = await getOwner(current.app, owner, '/orgs/999').expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it.each(MALFORMED_ORG_IDS)('answers the same 404 for the malformed id %p', async (orgId) => {
      const response = await getOwner(current.app, owner, `/orgs/${orgId}`).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers the same 404 to a non-member', async () => {
      const response = await getOwner(current.app, outsider, '/orgs/1').expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers the same 404 to a global admin who is not a member', async () => {
      current.userRepo.rows[1].isAdmin = true;

      const response = await getOwner(current.app, outsider, '/orgs/1').expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('answers 401 without authentication', async () => {
      await request(current.app.getHttpServer()).get('/orgs/1/widgets/owner.json').expect(401);
    });
  });

  describe('strict bodies', () => {
    it.each(['', '/orgs/1'])('accepts a valid body under %p', async (prefix) => {
      const response = await postEcho(current.app, owner, prefix, { label: 'ok' }).expect(201);

      expect(response.body.label).toBe('ok');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it.each([
      ['', { label: 'ok', userId: 2 }],
      ['', { label: 'ok', organizationId: 1 }],
      ['/orgs/1', { label: 'ok', userId: 2 }],
      ['/orgs/1', { label: 'ok', organizationId: 2 }],
    ])('answers 400 for an unknown field under %p', async (prefix, body) => {
      const response = await postEcho(current.app, owner, prefix, body);

      expectValidationErrorBody(response);
    });

    it('answers the uniform 404 before validating the body for a non-member', async () => {
      const response = await postEcho(current.app, outsider, '/orgs/1', { label: 'ok', organizationId: 1 }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });
  });
});
