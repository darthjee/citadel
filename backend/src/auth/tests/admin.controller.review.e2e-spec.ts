import request from 'supertest';
import { loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { RevokedReason } from '../entities/refresh-token.entity.js';
import { UserStatus } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';

const GATE_401 = { status: 401, code: ErrorCodes.UNAUTHORIZED, message: 'Invalid or expired access token' };
const NOT_PENDING = { status: 422, code: ErrorCodes.USER_NOT_PENDING, message: 'Only pending users can be approved' };

describe('AdminController review (e2e)', () => {
  const ctx = useTestApp({ adminGuard: true, registerDefaultUser: false });

  let adminCookie: string;
  let adminId: number;

  function userRow(username: string): { id?: number; status: UserStatus; isAdmin: boolean } {
    return ctx.userRepo.rows.find((row) => row.username === username)!;
  }

  function userId(username: string): number {
    return userRow(username).id as number;
  }

  function post(path: string, body: object = {}, cookie: string = adminCookie): request.Test {
    return request(ctx.app.getHttpServer()).post(path).set('Cookie', [cookie]).send(body);
  }

  // Seeds a user straight into the in-memory repo (no session), reusing the admin's password
  // digest (`my-password`) so the user can still log in, without one bcrypt hash per user.
  async function seedUser(username: string, email: string, status: UserStatus): Promise<void> {
    const { passwordDigest } = ctx.userRepo.rows.find((row) => row.username === 'obi-wan')!;

    await ctx.userRepo.save(ctx.userRepo.create({ username, email, passwordDigest, isAdmin: false, status }));
  }

  beforeEach(async () => {
    await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
    userRow('obi-wan').isAdmin = true;
    adminId = userId('obi-wan');
    adminCookie = await loginCookie(ctx.app, 'obi-wan');

    await seedUser('darth-pending', 'pending@example.com', UserStatus.PENDING);
    await seedUser('darth-denied', 'denied@example.com', UserStatus.DENIED);
    await seedUser('luke-pending', 'luke@example.com', UserStatus.PENDING);
  });

  describe('POST /admin/users/search.json', () => {
    function usernames(response: request.Response): string[] {
      return response.body.users.map((user: { username: string }) => user.username).sort();
    }

    it.each([
      [UserStatus.PENDING, ['darth-pending', 'luke-pending']],
      [UserStatus.APPROVED, ['obi-wan']],
      [UserStatus.DENIED, ['darth-denied']],
    ])('filters by status %s', async (status, expected) => {
      const response = await post('/admin/users/search.json', { status }).expect(201);

      expect(usernames(response)).toEqual(expected);
    });

    it('ANDs q with status', async () => {
      const response = await post('/admin/users/search.json', { q: 'darth', status: UserStatus.PENDING })
        .expect(201);

      expect(usernames(response)).toEqual(['darth-pending']);
    });

    it('returns users of every status when status is omitted', async () => {
      const response = await post('/admin/users/search.json', {}).expect(201);

      expect(usernames(response)).toEqual(['darth-denied', 'darth-pending', 'luke-pending', 'obi-wan']);
    });

    it('rejects an unknown status with 400 VALIDATION_FAILED', async () => {
      const response = await post('/admin/users/search.json', { status: 'bogus' });

      expectValidationErrorBody(response);
    });

    describe('the response', () => {
      let response: request.Response;

      beforeEach(async () => {
        response = await post('/admin/users/search.json', {}).expect(201);
      });

      it('carries the calling admin id as currentUserId', () => {
        expect(response.body.currentUserId).toBe(adminId);
      });

      it('carries the status of every item', () => {
        expect(response.body.users).toEqual(
          expect.arrayContaining([
            {
              id: userId('darth-pending'),
              username: 'darth-pending',
              email: 'pending@example.com',
              isAdmin: false,
              createdAt: expect.any(String),
              status: UserStatus.PENDING,
            },
            expect.objectContaining({ username: 'darth-denied', status: UserStatus.DENIED }),
            expect.objectContaining({ username: 'obi-wan', status: UserStatus.APPROVED }),
          ]),
        );
      });
    });
  });

  describe('POST /admin/users/:id/edit.json', () => {
    it('carries the status of the edited user', async () => {
      const response = await post(`/admin/users/${userId('darth-denied')}/edit.json`, { username: 'vader' })
        .expect(201);

      expect(response.body.user).toEqual(expect.objectContaining({ username: 'vader', status: UserStatus.DENIED }));
    });
  });

  describe('POST /admin/users/:id/approve.json', () => {
    function approve(username: string): request.Test {
      return post(`/admin/users/${userId(username)}/approve.json`);
    }

    describe('for a pending user', () => {
      let pendingCookie: string;
      let response: request.Response;

      beforeEach(async () => {
        pendingCookie = await loginCookie(ctx.app, 'darth-pending');
        await request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [pendingCookie]).expect(401);

        response = await approve('darth-pending');
      });

      it('answers 200 with the approved user', () => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          user: {
            id: userId('darth-pending'),
            username: 'darth-pending',
            email: 'pending@example.com',
            isAdmin: false,
            createdAt: expect.any(String),
            status: UserStatus.APPROVED,
          },
        });
      });

      it('stores the approved status', () => {
        expect(userRow('darth-pending').status).toBe(UserStatus.APPROVED);
      });

      it('lets the existing access token through the gate', async () => {
        await request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [pendingCookie]).expect(200);
      });
    });

    it.each([
      ['obi-wan', UserStatus.APPROVED],
      ['darth-denied', UserStatus.DENIED],
    ])('answers 422 USER_NOT_PENDING for %s (%s), leaving the status unchanged', async (username, status) => {
      const response = await approve(username);

      expectErrorBody(response, NOT_PENDING);
      expect(userRow(username).status).toBe(status);
    });

    it('answers 404 for an unknown user id', async () => {
      const response = await post('/admin/users/999999/approve.json');

      expectErrorBody(response, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    });

    it('never overwrites a deny landing between the lookup and the update', async () => {
      const update = ctx.userRepo.update;
      const spy = jest.spyOn(ctx.userRepo, 'update').mockImplementationOnce(async (criteria, partial) => {
        userRow('darth-pending').status = UserStatus.DENIED;

        return update(criteria, partial);
      });

      const response = await approve('darth-pending');

      expect(spy).toHaveBeenCalled();
      expectErrorBody(response, NOT_PENDING);
      expect(userRow('darth-pending').status).toBe(UserStatus.DENIED);
    });
  });

  describe('POST /admin/users/:id/deny.json', () => {
    function deny(username: string): request.Test {
      return post(`/admin/users/${userId(username)}/deny.json`);
    }

    function getProtected(cookie: string): request.Test {
      return request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [cookie]);
    }

    function tokenRowsOf(username: string): { revokedAt: Date | null; revokedReason: string | null }[] {
      return ctx.refreshTokenRepo.rows.filter((row) => row.userId === userId(username));
    }

    // Logs `username` in twice (two sessions), then logs the second session out, so the user has
    // one active refresh token and one already revoked with `logout`.
    async function loginTwiceAndLogoutOnce(username: string): Promise<string> {
      const first = await request(ctx.app.getHttpServer())
        .post('/auth/login.json').send({ username, password: 'my-password' }).expect(201);
      const second = await request(ctx.app.getHttpServer())
        .post('/auth/login.json').send({ username, password: 'my-password' }).expect(201);

      await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json').send({ refreshToken: second.body.refreshToken }).expect(204);

      return first.body.refreshToken;
    }

    // The first login was active (→ `admin_denied`); the logged-out session keeps its `logout` reason.
    function expectRevokedForDeny(username: string): void {
      expect(tokenRowsOf(username).map((row) => row.revokedReason).sort()).toEqual(
        [RevokedReason.ADMIN_DENIED, RevokedReason.LOGOUT],
      );
    }

    beforeEach(async () => {
      await seedUser('leia', 'leia@example.com', UserStatus.APPROVED);
    });

    describe.each([
      ['darth-pending', UserStatus.PENDING],
      ['leia', UserStatus.APPROVED],
    ])('for %s (%s)', (username) => {
      let response: request.Response;

      beforeEach(async () => {
        await loginTwiceAndLogoutOnce(username);
        response = await deny(username);
      });

      it('answers 200 with the denied user', () => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          user: expect.objectContaining({ id: userId(username), username, status: UserStatus.DENIED }),
        });
        expect(userRow(username).status).toBe(UserStatus.DENIED);
      });

      it('revokes every active token with admin_denied, keeping already-revoked reasons', () => {
        expect(tokenRowsOf(username).every((row) => row.revokedAt)).toBe(true);
        expectRevokedForDeny(username);
      });
    });

    it('answers 200 for an already denied user, revoking a still-active token', async () => {
      userRow('darth-denied').status = UserStatus.APPROVED;
      await loginTwiceAndLogoutOnce('darth-denied');
      userRow('darth-denied').status = UserStatus.DENIED;

      const response = await deny('darth-denied').expect(200);

      expect(response.body.user.status).toBe(UserStatus.DENIED);
      expectRevokedForDeny('darth-denied');
    });

    it('answers 422 CANNOT_DENY_SELF for the caller, changing nothing', async () => {
      const response = await deny('obi-wan');

      expectErrorBody(response, { status: 422, code: ErrorCodes.CANNOT_DENY_SELF, message: 'You cannot deny your own account' });
      expect(userRow('obi-wan').status).toBe(UserStatus.APPROVED);
      expect(tokenRowsOf('obi-wan').every((row) => row.revokedAt === null)).toBe(true);
      await post('/admin/users/search.json').expect(201);
    });

    it('lets an admin deny another admin', async () => {
      userRow('leia').isAdmin = true;

      const response = await deny('leia').expect(200);

      expect(response.body.user).toEqual(expect.objectContaining({ isAdmin: true, status: UserStatus.DENIED }));
    });

    it('answers 404 for an unknown user id', async () => {
      const response = await post('/admin/users/999999/deny.json');

      expectErrorBody(response, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    });

    it("blocks the denied user's access token on the next request", async () => {
      const cookie = await loginCookie(ctx.app, 'leia');
      await getProtected(cookie).expect(200);

      await deny('leia').expect(200);

      expectErrorBody(await getProtected(cookie), GATE_401);
    });

    it('still blocks the access token when the bulk revoke fails after the status update', async () => {
      const cookie = await loginCookie(ctx.app, 'leia');
      jest.spyOn(ctx.app.get(TokenService), 'revokeUserTokens').mockRejectedValueOnce(new Error('revoke failed'));

      const response = await deny('leia');

      expect(response.status).toBe(500);
      expect(userRow('leia').status).toBe(UserStatus.DENIED);
      expect(tokenRowsOf('leia').every((row) => row.revokedAt === null)).toBe(true);
      expectErrorBody(await getProtected(cookie), GATE_401);
    });

    it('answers a later refresh with a revoked token with a plain 401, without replay detection', async () => {
      const refreshToken = await loginTwiceAndLogoutOnce('leia');
      await deny('leia').expect(200);

      await request(ctx.app.getHttpServer()).post('/auth/refresh.json').send({ refreshToken }).expect(401);

      expectRevokedForDeny('leia');
    });
  });

  describe('access control', () => {
    const routes = ['approve.json', 'deny.json'];

    it.each(routes)('rejects an anonymous %s with 401', async (route) => {
      await request(ctx.app.getHttpServer()).post(`/admin/users/${userId('darth-pending')}/${route}`).expect(401);
    });

    it.each(routes)('rejects a non-admin %s with 403, changing nothing', async (route) => {
      await seedUser('han', 'han@example.com', UserStatus.APPROVED);
      const cookie = await loginCookie(ctx.app, 'han');

      await post(`/admin/users/${userId('darth-pending')}/${route}`, {}, cookie).expect(403);
      expect(userRow('darth-pending').status).toBe(UserStatus.PENDING);
    });
  });
});
