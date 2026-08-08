import request from 'supertest';
import { loginCookie, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('JwtGuard', () => {
    it('allows a public route through without a token', async () => {
      await request(ctx.app.getHttpServer()).get('/public').expect(200);
    });

    it('rejects a protected route with no access token', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/protected');

      expectErrorBody(response, { status: 401, code: ErrorCodes.UNAUTHORIZED, message: 'Missing access token' });
    });

    it('rejects a protected route with an invalid access token', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/protected')
        .set('Cookie', ['access_token=not-a-valid-jwt']);

      expectErrorBody(response, {
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      });
    });

    it('allows a protected route with a valid access token', async () => {
      const accessTokenCookie = await loginCookie(ctx.app);

      await request(ctx.app.getHttpServer())
        .get('/protected')
        .set('Cookie', [accessTokenCookie])
        .expect(200, { ok: true });
    });
  });
});
