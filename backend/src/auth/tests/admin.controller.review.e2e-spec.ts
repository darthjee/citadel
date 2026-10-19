import request from 'supertest';
import { loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectValidationErrorBody } from './support/error-body.js';
import { UserStatus } from '../entities/user.entity.js';

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
});
