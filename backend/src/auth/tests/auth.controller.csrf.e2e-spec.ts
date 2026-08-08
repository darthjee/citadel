import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { loginCookie, useTestApp } from './auth.controller.e2e-test-support.js';
import { buildAuthTestApp } from './support/build-auth-test-app.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

const EVIL_ORIGIN = 'https://evil.example';
const TRUSTED_ORIGIN = 'https://app.example.com';
const CREDENTIALS = { username: 'darthjee', password: 'my-password' };
const ACCOUNT_CHANGE = { currentPassword: 'my-password', username: 'new-username' };

// Browser-style headers attached to a request: a cross-site forgery from
// `EVIL_ORIGIN`, or a request from the page's own origin.
const CROSS_SITE = { 'Sec-Fetch-Site': 'cross-site', Origin: EVIL_ORIGIN };
const SAME_ORIGIN = { 'Sec-Fetch-Site': 'same-origin' };

function login(app: INestApplication, headers: Record<string, string> = {}): request.Test {
  return request(app.getHttpServer()).post('/auth/login.json').set(headers).send(CREDENTIALS);
}

function patchAccount(app: INestApplication, cookie: string, headers: Record<string, string> = {}): request.Test {
  return request(app.getHttpServer())
    .patch('/auth/account.json')
    .set('Cookie', [cookie])
    .set(headers)
    .send(ACCOUNT_CHANGE);
}

describe('AuthController CSRF protection (e2e)', () => {
  describe('with the default configuration', () => {
    const ctx = useTestApp();

    describe('POST /auth/login.json', () => {
      it('rejects a cross-site request with 403 and sets no cookie (login CSRF)', async () => {
        const response = await login(ctx.app, CROSS_SITE);

        expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN, message: 'Cross-site request rejected' });
        expect(response.headers['set-cookie']).toBeUndefined();
      });

      it('accepts a same-origin request', async () => {
        const response = await login(ctx.app, SAME_ORIGIN).expect(201);

        expect(response.headers['set-cookie'][0]).toMatch(/^access_token=/);
      });

      it('accepts a request with neither Origin nor Sec-Fetch-Site (non-browser client)', async () => {
        await login(ctx.app).expect(201);
      });
    });

    describe('PATCH /auth/account.json (authenticated)', () => {
      it('rejects a cross-site request carrying the session cookie with 403, not 401', async () => {
        const cookie = await loginCookie(ctx.app);

        await patchAccount(ctx.app, cookie, CROSS_SITE).expect(403);

        expect(ctx.userRepo.rows[0].username).toBe('darthjee');
      });

      it('rejects a cross-site request without the session cookie with 403, not 401', async () => {
        await request(ctx.app.getHttpServer())
          .patch('/auth/account.json')
          .set(CROSS_SITE)
          .send(ACCOUNT_CHANGE)
          .expect(403);
      });

      it('rejects a legacy-browser request from a foreign origin (no Sec-Fetch-Site)', async () => {
        const cookie = await loginCookie(ctx.app);

        await patchAccount(ctx.app, cookie, { Origin: EVIL_ORIGIN }).expect(403);
      });

      it('accepts a same-origin request', async () => {
        const cookie = await loginCookie(ctx.app);

        await patchAccount(ctx.app, cookie, SAME_ORIGIN).expect(200);

        expect(ctx.userRepo.rows[0].username).toBe('new-username');
      });

      it('accepts a request with neither Origin nor Sec-Fetch-Site (non-browser client)', async () => {
        const cookie = await loginCookie(ctx.app);

        await patchAccount(ctx.app, cookie).expect(200);
      });
    });

    describe('safe methods', () => {
      it('lets a cross-site GET through to the JWT guard', async () => {
        await request(ctx.app.getHttpServer()).get('/protected').set(CROSS_SITE).expect(401);
      });
    });
  });

  describe('with CITADEL_PLACEHOLDER_ALLOWED_ORIGINS set', () => {
    let app: INestApplication;

    beforeEach(async () => {
      ({ app } = await buildAuthTestApp({
        configOverrides: { CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: TRUSTED_ORIGIN },
      }));
    });

    afterEach(async () => {
      await app.close();
    });

    it('accepts a same-site request from an allowlisted origin', async () => {
      await login(app, { 'Sec-Fetch-Site': 'same-site', Origin: TRUSTED_ORIGIN }).expect(201);
    });

    it('still rejects a cross-site request from any other origin', async () => {
      await login(app, CROSS_SITE).expect(403);
    });
  });
});
