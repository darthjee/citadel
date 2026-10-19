import request from 'supertest';
import { loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { UserStatus } from '../entities/user.entity.js';

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

  beforeEach(async () => {
    await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
    userRow('obi-wan').isAdmin = true;
    adminId = userId('obi-wan');
    adminCookie = await loginCookie(ctx.app, 'obi-wan');

    await registerUser(ctx.app, { username: 'darth-pending', email: 'pending@example.com' });
    await registerUser(ctx.app, { username: 'darth-denied', email: 'denied@example.com' });
    await registerUser(ctx.app, { username: 'luke-pending', email: 'luke@example.com' });
    userRow('darth-pending').status = UserStatus.PENDING;
    userRow('darth-denied').status = UserStatus.DENIED;
    userRow('luke-pending').status = UserStatus.PENDING;
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

  describe('access control', () => {
    const routes = ['approve.json'];

    it.each(routes)('rejects an anonymous %s with 401', async (route) => {
      await request(ctx.app.getHttpServer()).post(`/admin/users/${userId('darth-pending')}/${route}`).expect(401);
    });

    it.each(routes)('rejects a non-admin %s with 403, changing nothing', async (route) => {
      await registerUser(ctx.app, { username: 'han', email: 'han@example.com' });
      const cookie = await loginCookie(ctx.app, 'han');

      await post(`/admin/users/${userId('darth-pending')}/${route}`, {}, cookie).expect(403);
      expect(userRow('darth-pending').status).toBe(UserStatus.PENDING);
    });
  });
});
