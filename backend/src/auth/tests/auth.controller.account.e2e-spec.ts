import request from 'supertest';
import { loginAs, loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('PATCH /auth/account.json', () => {
    function patchAccount(cookie: string, body: Record<string, string>): request.Test {
      return request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send(body);
    }

    it('rejects an unauthenticated request', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(401);
    });

    describe('with the right current password', () => {
      let response: request.Response;

      beforeEach(async () => {
        const cookie = await loginCookie(ctx.app);

        response = await patchAccount(cookie, {
          currentPassword: 'my-password',
          username: 'new-username',
        }).expect(200);
      });

      it('updates the username and responds with { username, email }', () => {
        expect(response.body).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
      });

      it('sets the X-Skip-Cache header', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    it('rejects the wrong current password without changing the account', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' });

      expectErrorBody(response, { status: 400, code: ErrorCodes.BAD_REQUEST, message: 'Invalid current password' });
      expect(ctx.userRepo.rows[0].username).toBe('darthjee');
    });

    it('answers a missing current password with 400 VALIDATION_FAILED', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { username: 'new-username' });

      expectValidationErrorBody(response);
      expect(response.body.error.details).toContain('currentPassword should not be empty');
    });

    describe('when the new username/email belongs to another user', () => {
      beforeEach(async () => {
        await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
      });

      it('answers a taken username with 409 USERNAME_TAKEN', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { currentPassword: 'my-password', username: 'obi-wan' });

        expectErrorBody(response, {
          status: 409,
          code: ErrorCodes.USERNAME_TAKEN,
          message: 'Username already in use',
        });
        expect(ctx.userRepo.rows[0].username).toBe('darthjee');
      });

      it('answers a taken email with 409 EMAIL_TAKEN', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { currentPassword: 'my-password', email: 'obi-wan@example.com' });

        expectErrorBody(response, {
          status: 409,
          code: ErrorCodes.EMAIL_TAKEN,
          message: 'Email already in use',
        });
        expect(ctx.userRepo.rows[0].email).toBe('darthjee@example.com');
      });
    });

    it('does not revoke the caller\'s other refresh tokens on a successful password change', async () => {
      const login = await loginAs(ctx.app);
      const accessTokenCookie = login.headers['set-cookie'][0].split(';')[0];

      await patchAccount(accessTokenCookie, {
        currentPassword: 'my-password',
        newPassword: 'brand-new-password',
      }).expect(200);

      await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);
    });

    it(
      'locks the account out with 423 after 5 failed attempts, even with the right password',
      async () => {
        const cookie = await loginCookie(ctx.app);

        for (let i = 0; i < 5; i += 1) {
          await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' })
            .expect(400);
        }

        const response = await patchAccount(cookie, { currentPassword: 'my-password', username: 'new-username' });

        expectErrorBody(response, {
          status: 423,
          code: ErrorCodes.LOCKED,
          message: 'Account temporarily locked due to too many failed attempts',
        });
      },
      15000,
    );
  });
});
