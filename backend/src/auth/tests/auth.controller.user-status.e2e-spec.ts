import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { loginAs, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { createAuthorizationRequest } from './authorization-request.controller.e2e-test-support.js';
import { buildAuthTestApp } from './support/build-auth-test-app.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { User, UserStatus } from '../entities/user.entity.js';

const INVALID = { status: 401, code: ErrorCodes.UNAUTHORIZED, message: 'Invalid or expired access token' };
const USER_KEYS = ['email', 'id', 'isAdmin', 'username'];

// Drops the per-response `timestamp`, so two error bodies compare byte-for-byte otherwise.
function withoutTimestamp(body: Record<string, unknown>): string {
  return JSON.stringify({ ...body, timestamp: undefined });
}

function cookieOf(response: request.Response): string {
  return response.headers['set-cookie'][0].split(';')[0];
}

// Cross-cutting non-disclosure checks of docs/agents/modules/auth/user-approval.md:
// a pending or denied user is indistinguishable from an expired / logged-out one, and no auth
// endpoint's `user` payload ever carries the status.
describe('AuthController (e2e) — user status non-disclosure', () => {
  const ctx = useTestApp();

  function userRow(): User {
    return ctx.userRepo.rows[0];
  }

  function getProtected(cookie: string): request.Test {
    return request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [cookie]);
  }

  async function expiredCookie(): Promise<string> {
    const login = await loginAs(ctx.app).expect(201);
    const payload = ctx.app.get(JwtService).decode<Record<string, unknown>>(cookieOf(login).slice('access_token='.length));
    const claims = { sub: payload.sub, sid: payload.sid, username: payload.username, isAdmin: payload.isAdmin };
    const token = ctx.app.get(JwtService).sign(claims, { expiresIn: -10 });

    return `access_token=${token}`;
  }

  describe('protected route 401', () => {
    it.each([UserStatus.PENDING, UserStatus.DENIED])(
      "answers a %s user's access token byte-for-byte like an expired token",
      async (status) => {
        const expired = await getProtected(await expiredCookie());
        const login = await loginAs(ctx.app).expect(201);
        userRow().status = status;

        const blocked = await getProtected(cookieOf(login));

        expectErrorBody(blocked, INVALID);
        expectErrorBody(expired, INVALID);
        expect(withoutTimestamp(blocked.body)).toBe(withoutTimestamp(expired.body));
        expect(blocked.headers['content-type']).toBe(expired.headers['content-type']);
      },
    );
  });

  describe('status.json', () => {
    it('answers a denied user byte-for-byte like an unknown token', async () => {
      const login = await loginAs(ctx.app).expect(201);
      userRow().status = UserStatus.DENIED;

      const denied = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);
      const anonymous = await request(ctx.app.getHttpServer())
        .post('/auth/status.json')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(201);

      expect(denied.text).toBe(anonymous.text);
      expect(denied.headers['content-type']).toBe(anonymous.headers['content-type']);
    });
  });

  describe('user payload never carries the status', () => {
    it.each([UserStatus.APPROVED, UserStatus.PENDING])('login.json for a %s user', async (status) => {
      userRow().status = status;

      const response = await loginAs(ctx.app).expect(201);

      expect(Object.keys(response.body.user).sort()).toEqual(USER_KEYS);
    });

    it('login.json for a denied user answers no user at all', async () => {
      userRow().status = UserStatus.DENIED;

      const response = await loginAs(ctx.app).expect(403);

      expect(response.body).not.toHaveProperty('user');
    });

    it.each([UserStatus.APPROVED, UserStatus.PENDING])('refresh.json for a %s user', async (status) => {
      const login = await loginAs(ctx.app).expect(201);
      userRow().status = status;

      const response = await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(Object.keys(response.body.user).sort()).toEqual(USER_KEYS);
    });

    it('register.json with the flag off (approved)', async () => {
      const response = await registerUser(ctx.app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);

      expect(Object.keys(response.body.user).sort()).toEqual(USER_KEYS);
    });

    it('register.json with the flag on (pending)', async () => {
      const { app } = await buildAuthTestApp({
        registerDefaultUser: false,
        configOverrides: { CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED: 'true' },
      });

      try {
        const response = await registerUser(app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);

        expect(Object.keys(response.body.user).sort()).toEqual(USER_KEYS);
      } finally {
        await app.close();
      }
    });

    async function winningPoll(status: UserStatus): Promise<request.Response> {
      const login = await loginAs(ctx.app).expect(201);
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/authorize.json`)
        .set('Cookie', [cookieOf(login)])
        .send({ password: 'my-password' })
        .expect(201);
      userRow().status = status;

      return request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);
    }

    it('the winning device-authorization poll of an approved user', async () => {
      const response = await winningPoll(UserStatus.APPROVED);

      expect(response.body.status).toBe('approved');
      expect(Object.keys(response.body.user).sort()).toEqual(USER_KEYS);
    });

    it.each([UserStatus.PENDING, UserStatus.DENIED])(
      'the winning device-authorization poll of a %s user answers no user at all',
      async (status) => {
        const response = await winningPoll(status);

        expect(response.body).toEqual({ status: 'denied' });
      },
    );
  });
});
