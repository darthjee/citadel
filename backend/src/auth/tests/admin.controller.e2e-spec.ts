import request from 'supertest';
import { loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AdminController (e2e)', () => {
  const ctx = useTestApp({ adminGuard: true, registerDefaultUser: false });

  async function registerAndLogin(username: string, email: string): Promise<string> {
    await registerUser(ctx.app, { username, email });

    return loginCookie(ctx.app, username);
  }

  describe('when the caller is unauthenticated', () => {
    it('rejects users/search.json with 401', async () => {
      await request(ctx.app.getHttpServer()).post('/admin/users/search.json').send({}).expect(401);
    });

    it('rejects recovery-link.json with 401', async () => {
      await request(ctx.app.getHttpServer()).post('/admin/users/1/recovery-link.json').expect(401);
    });

    it('rejects send-recovery-email.json with 401', async () => {
      await request(ctx.app.getHttpServer()).post('/admin/users/1/send-recovery-email.json').expect(401);
    });

    it('rejects edit.json with 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/edit.json')
        .send({ username: 'new-username' })
        .expect(401);
    });
  });

  describe('when the caller is authenticated but not an admin', () => {
    let cookie: string;

    beforeEach(async () => {
      cookie = await registerAndLogin('darthjee', 'darthjee@example.com');
    });

    it('rejects users/search.json with 403 FORBIDDEN', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/admin/users/search.json')
        .set('Cookie', [cookie])
        .send({});

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN, message: 'Admin access required' });
    });

    it('rejects recovery-link.json with 403', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/recovery-link.json')
        .set('Cookie', [cookie])
        .expect(403);
    });

    it('rejects send-recovery-email.json with 403', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/send-recovery-email.json')
        .set('Cookie', [cookie])
        .expect(403);
    });

    it('rejects edit.json with 403', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/edit.json')
        .set('Cookie', [cookie])
        .send({ username: 'new-username' })
        .expect(403);
    });
  });

  describe('when the caller is an admin', () => {
    let adminCookie: string;
    let targetUserId: number;

    beforeEach(async () => {
      await registerUser(ctx.app, { username: 'darthjee', email: 'darthjee@example.com' });
      targetUserId = ctx.userRepo.rows[0].id as number;

      await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
      const adminRow = ctx.userRepo.rows.find((row) => row.username === 'obi-wan')!;
      adminRow.isAdmin = true;

      adminCookie = await loginCookie(ctx.app, 'obi-wan');
    });

    describe('POST /admin/users/search.json', () => {
      describe('when q is omitted', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post('/admin/users/search.json')
            .set('Cookie', [adminCookie])
            .send({})
            .expect(201);
        });

        it('returns every user', () => {
          expect(response.body.users).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: targetUserId,
                username: 'darthjee',
                email: 'darthjee@example.com',
                isAdmin: false,
                createdAt: expect.any(String),
              }),
            ]),
          );
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('filters by q against username/email', async () => {
        const response = await request(ctx.app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({ q: 'darth' })
          .expect(201);

        expect(response.body.users).toHaveLength(1);
        expect(response.body.users[0]).toEqual(expect.objectContaining({ username: 'darthjee' }));
      });
    });

    describe('POST /admin/users/:id/recovery-link.json', () => {
      describe('for an existing user', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post(`/admin/users/${targetUserId}/recovery-link.json`)
            .set('Cookie', [adminCookie])
            .expect(201);
        });

        it('mints a fresh recovery link', () => {
          expect(response.body).toEqual({
            resetUrl: expect.stringMatching(/\/#\/recover-password\?token=.+$/),
          });
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('responds 404 for an unknown user id', async () => {
        await request(ctx.app.getHttpServer())
          .post('/admin/users/999999/recovery-link.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });

    describe('POST /admin/users/:id/send-recovery-email.json', () => {
      describe('for an existing user', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post(`/admin/users/${targetUserId}/send-recovery-email.json`)
            .set('Cookie', [adminCookie])
            .expect(201);
        });

        it('responds with a sent boolean', () => {
          expect(response.body).toEqual({ sent: expect.any(Boolean) });
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('responds 404 for an unknown user id', async () => {
        await request(ctx.app.getHttpServer())
          .post('/admin/users/999999/send-recovery-email.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });

    describe('POST /admin/users/:id/edit.json', () => {
      describe('for an existing user', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post(`/admin/users/${targetUserId}/edit.json`)
            .set('Cookie', [adminCookie])
            .send({
              username: 'darthjee-renamed',
              email: 'darthjee-renamed@example.com',
              newPassword: 'brand-new-password',
            })
            .expect(201);
        });

        it('updates the username, email, and password', () => {
          expect(response.body).toEqual({
            user: expect.objectContaining({
              id: targetUserId,
              username: 'darthjee-renamed',
              email: 'darthjee-renamed@example.com',
              isAdmin: false,
              createdAt: expect.any(String),
            }),
          });
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('responds 404 for an unknown user id', async () => {
        await request(ctx.app.getHttpServer())
          .post('/admin/users/999999/edit.json')
          .set('Cookie', [adminCookie])
          .send({ username: 'new-username' })
          .expect(404);
      });

      it('responds 400 without applying changes when no field is given', async () => {
        await request(ctx.app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({})
          .expect(400);
      });

      it('responds 400 (not a raw 500) when newPassword is shorter than 8 characters', async () => {
        await request(ctx.app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({ newPassword: 'short' })
          .expect(400);
      });
    });
  });
});
