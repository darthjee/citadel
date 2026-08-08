import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('refresh token rotation', () => {
    it('issues a new token pair and invalidates the old refresh token', async () => {
      const login = await loginAs(ctx.app);
      const oldRefreshToken = login.body.refreshToken;

      const refreshed = await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: oldRefreshToken })
        .expect(201);

      expect(refreshed.body.refreshToken).not.toBe(oldRefreshToken);

      await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('rejects an expired refresh token', async () => {
      const login = await loginAs(ctx.app);

      // `rows[0]` is the token issued by `register()` in the outer
      // `beforeEach` — the one under test here is the last one created, by
      // this test's own `login` call.
      ctx.refreshTokenRepo.rows[ctx.refreshTokenRepo.rows.length - 1].expiresAt = new Date(Date.now() - 1000);

      await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('invalidates the refresh token and clears the access-token cookie', async () => {
      const login = await loginAs(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      expect(response.headers['set-cookie'][0]).toMatch(/^access_token=;/);

      await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });
  });

  describe('status check', () => {
    it('resolves loggedIn: true for an active refresh token', async () => {
      const login = await loginAs(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: true, isAdmin: false });
    });

    it('resolves loggedIn: false for an unknown refresh token, without a 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
    });

    it('resolves loggedIn: false for a revoked refresh token, without revoking the token family', async () => {
      const login = await loginAs(ctx.app);

      await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      const response = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
    });

    it('resolves isAdmin: true for an active refresh token belonging to an admin', async () => {
      ctx.userRepo.rows[0].isAdmin = true;

      const login = await loginAs(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
    });

    it('does not set or clear the access-token cookie', async () => {
      const login = await loginAs(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('is reachable without an access-token cookie, being @Public()', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: 'whatever' })
        .expect(201);
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: 'whatever' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
