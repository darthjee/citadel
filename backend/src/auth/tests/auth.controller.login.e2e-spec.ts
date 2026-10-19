import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { hashToken } from '../../core/token-hash.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

  describe('sessions', () => {
    function sessionUuidOf(refreshToken: string): string | undefined {
      return ctx.refreshTokenRepo.rows.find((row) => row.tokenHash === hashToken(refreshToken))?.sessionUuid;
    }

    it('persists the refresh token with a fresh session', async () => {
      const before = Date.now();
      const response = await loginAs(ctx.app).expect(201);
      const row = ctx.refreshTokenRepo.rows.find((candidate) => candidate.tokenHash === hashToken(response.body.refreshToken));

      expect(row?.sessionUuid).toMatch(UUID_PATTERN);
      expect(row?.startedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(ctx.refreshTokenRepo.rows.filter((candidate) => candidate.sessionUuid === row?.sessionUuid)).toHaveLength(1);
    });

    it('gives two logins of the same user two different sessions', async () => {
      const first = await loginAs(ctx.app).expect(201);
      const second = await loginAs(ctx.app).expect(201);

      expect(sessionUuidOf(first.body.refreshToken)).toMatch(UUID_PATTERN);
      expect(sessionUuidOf(second.body.refreshToken)).toMatch(UUID_PATTERN);
      expect(sessionUuidOf(first.body.refreshToken)).not.toBe(sessionUuidOf(second.body.refreshToken));
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
