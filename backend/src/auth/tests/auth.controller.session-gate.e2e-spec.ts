import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { hashToken } from '../../core/token-hash.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';

const INVALID = { status: 401, code: ErrorCodes.UNAUTHORIZED, message: 'Invalid or expired access token' };

interface Session {
  cookie: string;
  accessToken: string;
  refreshToken: string;
}

function sessionOf(response: request.Response): Session {
  const cookie = response.headers['set-cookie'][0].split(';')[0];

  return { cookie, accessToken: cookie.slice('access_token='.length), refreshToken: response.body.refreshToken };
}

describe('AuthController (e2e)', () => {
  describe('session gate', () => {
    const ctx = useTestApp();

    async function login(): Promise<Session> {
      return sessionOf(await loginAs(ctx.app).expect(201));
    }

    function getProtected(cookie: string): request.Test {
      return request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [cookie]);
    }

    function rowOf(refreshToken: string): RefreshToken {
      const row = ctx.refreshTokenRepo.rows.find((candidate) => candidate.tokenHash === hashToken(refreshToken));

      if (!row) {
        throw new Error('refresh token row not found');
      }

      return row;
    }

    function sidOf(accessToken: string): string {
      return ctx.app.get(JwtService).decode<{ sid: string }>(accessToken).sid;
    }

    it('blocks the same access token on the next request after logout', async () => {
      const session = await login();
      await getProtected(session.cookie).expect(200, { ok: true });

      await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: session.refreshToken })
        .expect(204);

      expectErrorBody(await getProtected(session.cookie), INVALID);
    });

    it('keeps the other session working when one of two sessions logs out', async () => {
      const first = await login();
      const second = await login();

      await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: first.refreshToken })
        .expect(204);

      expectErrorBody(await getProtected(first.cookie), INVALID);
      await getProtected(second.cookie).expect(200, { ok: true });
    });

    it('blocks previously issued access tokens after a password reset', async () => {
      const session = await login();
      await getProtected(session.cookie).expect(200, { ok: true });
      const eventEmitter = ctx.app.get(EventEmitter2);
      const tokenPromise = new Promise<string>((resolve) => {
        eventEmitter.once('password-recovery.requested', (event: { token: string }) => resolve(event.token));
      });

      await request(ctx.app.getHttpServer()).post('/auth/recover.json').send({ email: 'darthjee@example.com' });
      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token: await tokenPromise, password: 'brand-new-password' })
        .expect(200);

      expectErrorBody(await getProtected(session.cookie), INVALID);
    });

    it('blocks an access token whose session expired', async () => {
      const session = await login();
      await getProtected(session.cookie).expect(200, { ok: true });
      rowOf(session.refreshToken).expiresAt = new Date(Date.now() - 1000);

      expectErrorBody(await getProtected(session.cookie), INVALID);
    });

    it('mints, on refresh, an access token carrying the session uuid as sid, which passes the gate', async () => {
      const session = await login();
      const { sessionUuid } = rowOf(session.refreshToken);

      const refreshed = sessionOf(
        await request(ctx.app.getHttpServer())
          .post('/auth/refresh.json')
          .send({ refreshToken: session.refreshToken })
          .expect(201),
      );

      expect(sidOf(session.accessToken)).toBe(sessionUuid);
      expect(sidOf(refreshed.accessToken)).toBe(sessionUuid);
      expect(rowOf(refreshed.refreshToken).sessionUuid).toBe(sessionUuid);
      await getProtected(refreshed.cookie).expect(200, { ok: true });
    });
  });

  describe('session gate with AdminGuard', () => {
    const ctx = useTestApp({ adminGuard: true });

    function search(cookie: string): request.Test {
      return request(ctx.app.getHttpServer()).post('/admin/users/search.json').set('Cookie', [cookie]).send({});
    }

    it('answers 403 on the next @AdminOnly() call after the admin is demoted', async () => {
      const userRow = ctx.userRepo.rows.find((row) => row.username === 'darthjee');

      if (!userRow) {
        throw new Error('user row not found');
      }

      userRow.isAdmin = true;
      const { cookie } = sessionOf(await loginAs(ctx.app).expect(201));
      await search(cookie).expect(201);

      userRow.isAdmin = false;

      expectErrorBody(await search(cookie), {
        status: 403,
        code: ErrorCodes.FORBIDDEN,
        message: 'Admin access required',
      });
    });
  });
});
