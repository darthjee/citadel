import request from 'supertest';
import {
  createAuthorizationRequest,
  login,
  postMine,
  useTestApp,
} from './authorization-request.controller.e2e-test-support.js';

describe('AuthorizationRequestController (e2e)', () => {
  const ctx = useTestApp();

  describe('approver routes', () => {
    let ownerCookie: string;
    let attackerCookie: string;

    beforeEach(async () => {
      ownerCookie = await login(ctx.app, 'darthjee', 'my-password');

      await request(ctx.app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'vader', email: 'vader@example.com', password: 'attacker-password' });
      attackerCookie = await login(ctx.app, 'vader', 'attacker-password');
    });

    describe('mine', () => {
      it('rejects an unauthenticated call with 401', async () => {
        await request(ctx.app.getHttpServer()).post('/auth/authorization-requests/mine.json').send({}).expect(401);
      });

      it("returns only the caller's own open, non-expired requests, newest first", async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        const response = await postMine(ctx.app, ownerCookie);

        expect(response.body).toEqual({
          requests: [
            {
              uuid,
              requestIp: expect.any(String),
              requestUserAgent: expect.any(String),
              createdAt: expect.any(String),
              expiresAt: expect.any(String),
            },
          ],
        });
      });

      it("never returns a request raised against another user's username", async () => {
        await createAuthorizationRequest(ctx.app, 'vader');

        const response = await postMine(ctx.app, ownerCookie);

        expect(response.body).toEqual({ requests: [] });
      });

      it('never returns a request with userId: null (unresolved username)', async () => {
        await createAuthorizationRequest(ctx.app, 'nobody');

        const response = await postMine(ctx.app, ownerCookie);

        expect(response.body).toEqual({ requests: [] });
      });
    });

    describe('authorize', () => {
      it('rejects an unauthenticated call with 401', async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .send({ password: 'my-password' })
          .expect(401);
      });

      it('rejects a wrong password with 400', async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'wrong-password' })
          .expect(400);
      });

      it("rejects the attacker authorizing the owner's request with 400", async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [attackerCookie])
          .send({ password: 'attacker-password' })
          .expect(400);
      });

      it('authorizes on the correct password, and a subsequent poll grants credentials exactly once', async () => {
        const { uuid, pollToken } = await createAuthorizationRequest(ctx.app, 'darthjee');

        const response = await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'my-password' })
          .expect(201);

        expect(response.body).toEqual({ authorized: true });

        const approvedPoll = await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(approvedPoll.body).toEqual({
          status: 'approved',
          user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com', isAdmin: false },
          refreshToken: expect.any(String),
        });

        const secondPoll = await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(secondPoll.body).toEqual({ status: 'logged' });
      });
    });

    describe('deny', () => {
      it('rejects an unauthenticated call with 401', async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .send({})
          .expect(401);
      });

      it("rejects the attacker denying the owner's request with 400", async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [attackerCookie])
          .send({})
          .expect(400);
      });

      it('denies on the owner call, and a subsequent poll returns { status: "denied" }', async () => {
        const { uuid, pollToken } = await createAuthorizationRequest(ctx.app, 'darthjee');

        const response = await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({ denied: true });

        const pollResponse = await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(pollResponse.body).toEqual({ status: 'denied' });
      });
    });

    describe('X-Skip-Cache header', () => {
      it('is set on the mine response', async () => {
        const response = await postMine(ctx.app, ownerCookie);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('is set on the authorize response', async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        const response = await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'my-password' })
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('is set on the deny response', async () => {
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        const response = await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });
  });
});
