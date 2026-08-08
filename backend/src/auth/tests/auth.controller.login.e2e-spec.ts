import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('login flow', () => {
    it('logs in with valid credentials, returning the user and a refresh token', async () => {
      const response = await loginAs(ctx.app).expect(201);

      expect(response.body).toEqual({
        user: {
          id: expect.any(Number),
          username: 'darthjee',
          email: 'darthjee@example.com',
          isAdmin: false,
        },
        refreshToken: expect.any(String),
      });
    });

    it('rejects an invalid password with 401 UNAUTHORIZED', async () => {
      const response = await loginAs(ctx.app, 'darthjee', 'wrong-password');

      expectErrorBody(response, {
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid username or password',
      });
    });

    it('rejects an unknown username with the same 401 body as a wrong password', async () => {
      const response = await loginAs(ctx.app, 'nobody', 'wrong-password');

      expectErrorBody(response, {
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid username or password',
      });
    });

    it('sets the access token as an httpOnly, secure, SameSite=Strict cookie', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = response.headers['set-cookie'][0];

      expect(cookie).toMatch(/^access_token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });
  });

  describe('oversized request body', () => {
    it('answers 413 with the standard body, not a 500', async () => {
      // Nest's default JSON body-parser limit is 100kb.
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'x'.repeat(200 * 1024) });

      expectErrorBody(response, { status: 413, code: 'HTTP_413', message: 'Payload Too Large' });
    });
  });

  describe('access-token cookie maxAge', () => {
    it('defaults to 900 seconds (15 minutes) when CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS is unset', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = response.headers['set-cookie'][0];

      expect(cookie).toMatch(/Max-Age=900\b/);
    });
  });
});
