import request from 'supertest';
import { createAuthorizationRequest, useTestApp } from './authorization-request.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthorizationRequestController (e2e)', () => {
  const ctx = useTestApp();

  function approve(uuid: string): void {
    const row = ctx.authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);

    if (row) {
      row.status = 'approved';
    }
  }

  describe('full poll flow', () => {
    it('goes open -> approved (Set-Cookie + refreshToken) -> logged (no credentials)', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);

      const openResponse = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(openResponse.body).toEqual({ status: 'open' });

      approve(uuid);

      const approvedResponse = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(approvedResponse.body).toEqual({
        status: 'approved',
        user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com', isAdmin: false },
        refreshToken: expect.any(String),
      });
      expect(approvedResponse.headers['set-cookie'][0]).toMatch(/^access_token=/);

      const loggedResponse = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(loggedResponse.body).toEqual({ status: 'logged' });
      expect(loggedResponse.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('expiry path', () => {
    it('flips an overdue open request to expired', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      const row = ctx.authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);
      row!.expiresAt = new Date(Date.now() - 1000);

      const response = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.body).toEqual({ status: 'expired' });
    });
  });

  describe('wrong poll token', () => {
    it('returns 404, indistinguishable from an unknown uuid', async () => {
      const { uuid } = await createAuthorizationRequest(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken: 'wrong-token' });

      expectErrorBody(response, {
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: 'Authorization request not found',
      });
    });

    it('returns 404 NOT_FOUND for an unknown uuid', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests/not-a-real-uuid/poll.json')
        .send({ pollToken: 'whatever' });

      expectErrorBody(response, {
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: 'Authorization request not found',
      });
    });
  });

  describe('concurrent post-approval polls', () => {
    it('grants credentials to exactly one of two simultaneous polls', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      approve(uuid);

      const [first, second] = await Promise.all([
        request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
        request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
      ]);

      const statuses = [first.body.status, second.body.status].sort();

      expect(statuses).toEqual(['approved', 'logged']);
    });
  });

  describe('X-Skip-Cache header', () => {
    it('is set on every poll response', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
