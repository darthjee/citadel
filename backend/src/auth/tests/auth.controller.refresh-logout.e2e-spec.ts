import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';
import { hashToken } from '../../core/token-hash.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { UserStatus } from '../entities/user.entity.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  function rowOf(refreshToken: string): RefreshToken {
    const row = ctx.refreshTokenRepo.rows.find((candidate) => candidate.tokenHash === hashToken(refreshToken));

    if (!row) {
      throw new Error('refresh token row not found');
    }

    return row;
  }

  describe('refresh token rotation', () => {
    it('issues a new token pair and invalidates the old refresh token', async () => {
      const login = await loginAs(ctx.app);
      const oldRefreshToken = login.body.refreshToken;

      const refreshed = await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: oldRefreshToken })
        .expect(201);

      expect(refreshed.body.refreshToken).not.toBe(oldRefreshToken);

      const oldRow = rowOf(oldRefreshToken);
      const newRow = rowOf(refreshed.body.refreshToken);

      expect(newRow.sessionUuid).toBe(oldRow.sessionUuid);
      expect(newRow.startedAt).toEqual(oldRow.startedAt);
      expect(newRow.revokedAt).toBeNull();
      expect(oldRow.revokedAt).toEqual(expect.any(Date));
      expect(oldRow.revokedReason).toBe('rotated');
      expect(ctx.refreshTokenRepo.rows.filter((row) => row.sessionUuid === oldRow.sessionUuid && !row.revokedAt)).toHaveLength(1);

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

  describe('session-wide logout', () => {
    async function refresh(refreshToken: string): Promise<request.Response> {
      return request(ctx.app.getHttpServer()).post('/auth/refresh.json').send({ refreshToken });
    }

    async function logout(refreshToken: string): Promise<void> {
      await request(ctx.app.getHttpServer()).delete('/auth/logoff.json').send({ refreshToken }).expect(204);
    }

    function activeRowsOf(sessionUuid: string): RefreshToken[] {
      return ctx.refreshTokenRepo.rows.filter((row) => row.sessionUuid === sessionUuid && !row.revokedAt);
    }

    it('ends the session with a stale (rotated) token, leaving the user\'s other sessions active', async () => {
      const first = await loginAs(ctx.app).expect(201);
      const second = await loginAs(ctx.app).expect(201);
      const firstSession = rowOf(first.body.refreshToken).sessionUuid;
      const secondSession = rowOf(second.body.refreshToken).sessionUuid;

      const refreshed = await refresh(first.body.refreshToken);
      expect(refreshed.status).toBe(201);

      await logout(first.body.refreshToken);

      expect(activeRowsOf(firstSession)).toHaveLength(0);
      expect(rowOf(refreshed.body.refreshToken).revokedReason).toBe('logout');
      expect(rowOf(first.body.refreshToken).revokedReason).toBe('rotated');
      expect(activeRowsOf(secondSession)).toHaveLength(1);
      expect((await refresh(second.body.refreshToken)).status).toBe(201);
    });

    it('answers a replayed logout token with 401, without revoking other sessions', async () => {
      const first = await loginAs(ctx.app).expect(201);
      const second = await loginAs(ctx.app).expect(201);
      const secondSession = rowOf(second.body.refreshToken).sessionUuid;

      await logout(first.body.refreshToken);

      expect((await refresh(first.body.refreshToken)).status).toBe(401);
      expect(rowOf(first.body.refreshToken).revokedReason).toBe('logout');
      expect(activeRowsOf(secondSession)).toHaveLength(1);
    });

    it('answers a replayed rotated token with 401, revoking every active token with replay_detected', async () => {
      const first = await loginAs(ctx.app).expect(201);
      const second = await loginAs(ctx.app).expect(201);
      const refreshed = await refresh(first.body.refreshToken);

      expect((await refresh(first.body.refreshToken)).status).toBe(401);
      expect(rowOf(first.body.refreshToken).revokedReason).toBe('rotated');
      expect(rowOf(refreshed.body.refreshToken).revokedReason).toBe('replay_detected');
      expect(rowOf(second.body.refreshToken).revokedReason).toBe('replay_detected');
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

  describe('by account status', () => {
    function setStatus(status: UserStatus): void {
      ctx.userRepo.rows[0].status = status;
    }

    function status(refreshToken: string): request.Test {
      return request(ctx.app.getHttpServer()).post('/auth/status.json').send({ refreshToken }).expect(201);
    }

    function refresh(refreshToken: string): request.Test {
      return request(ctx.app.getHttpServer()).post('/auth/refresh.json').send({ refreshToken });
    }

    describe('status check', () => {
      it('answers a pending user with the pending answer, keeping the session', async () => {
        const login = await loginAs(ctx.app).expect(201);
        setStatus(UserStatus.PENDING);

        const response = await status(login.body.refreshToken);

        expect(response.body).toEqual({ loggedIn: false, isAdmin: false, status: 'pending' });
        expect(rowOf(login.body.refreshToken).revokedAt).toBeNull();
      });

      it('answers loggedIn: true once the pending user is approved, with the same token', async () => {
        const login = await loginAs(ctx.app).expect(201);
        setStatus(UserStatus.PENDING);
        await status(login.body.refreshToken);
        setStatus(UserStatus.APPROVED);

        const response = await status(login.body.refreshToken);

        expect(response.body).toEqual({ loggedIn: true, isAdmin: false });
      });

      it('answers a denied user with the anonymous answer byte-for-byte, revoking the token with admin_denied', async () => {
        const login = await loginAs(ctx.app).expect(201);
        const other = await loginAs(ctx.app).expect(201);
        setStatus(UserStatus.DENIED);

        const denied = await status(login.body.refreshToken);
        const unknown = await status('not-a-real-token');

        expect(denied.text).toBe(unknown.text);
        expect(denied.body).toEqual({ loggedIn: false, isAdmin: false });
        expect(rowOf(login.body.refreshToken).revokedReason).toBe('admin_denied');
        expect(rowOf(other.body.refreshToken).revokedAt).toBeNull();
      });

      it('carries the status key only for a pending user', async () => {
        const login = await loginAs(ctx.app).expect(201);

        expect((await status(login.body.refreshToken)).body).not.toHaveProperty('status');
        expect((await status('not-a-real-token')).body).not.toHaveProperty('status');
      });

      it('answers a pending user whose token expired anonymously, then pending after a new login', async () => {
        const login = await loginAs(ctx.app).expect(201);
        setStatus(UserStatus.PENDING);
        rowOf(login.body.refreshToken).expiresAt = new Date(Date.now() - 1000);

        expect((await status(login.body.refreshToken)).body).toEqual({ loggedIn: false, isAdmin: false });

        const again = await loginAs(ctx.app).expect(201);

        expect((await status(again.body.refreshToken)).body).toEqual({
          loggedIn: false,
          isAdmin: false,
          status: 'pending',
        });
      });
    });

    describe('refresh', () => {
      it('rotates a pending user token, copying the session', async () => {
        const login = await loginAs(ctx.app).expect(201);
        setStatus(UserStatus.PENDING);

        const refreshed = await refresh(login.body.refreshToken).expect(201);

        expect(rowOf(login.body.refreshToken).revokedReason).toBe('rotated');
        expect(rowOf(refreshed.body.refreshToken).sessionUuid).toBe(rowOf(login.body.refreshToken).sessionUuid);
      });

      it('answers a denied user active token with 401, revoking only it with admin_denied', async () => {
        const login = await loginAs(ctx.app).expect(201);
        const other = await loginAs(ctx.app).expect(201);
        setStatus(UserStatus.DENIED);

        const response = await refresh(login.body.refreshToken);

        expect(response.status).toBe(401);
        expect(response.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
        expect(rowOf(login.body.refreshToken).revokedReason).toBe('admin_denied');
        expect(rowOf(other.body.refreshToken).revokedAt).toBeNull();
      });

      it('answers an admin_denied token presented again with 401, without replay detection', async () => {
        const login = await loginAs(ctx.app).expect(201);
        const other = await loginAs(ctx.app).expect(201);
        setStatus(UserStatus.DENIED);
        await refresh(login.body.refreshToken).expect(401);

        await refresh(login.body.refreshToken).expect(401);

        expect(rowOf(login.body.refreshToken).revokedReason).toBe('admin_denied');
        expect(rowOf(other.body.refreshToken).revokedAt).toBeNull();
      });

      it('rejects a token minted right before a deny (race), and its access token fails the gate', async () => {
        const login = await loginAs(ctx.app).expect(201);
        const cookie = login.headers['set-cookie'][0].split(';')[0];
        setStatus(UserStatus.DENIED);

        await refresh(login.body.refreshToken).expect(401);

        expect(rowOf(login.body.refreshToken).revokedReason).toBe('admin_denied');
        await request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [cookie]).expect(401);
      });
    });
  });
});
