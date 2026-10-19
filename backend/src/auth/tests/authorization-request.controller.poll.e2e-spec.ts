import request from 'supertest';
import { createAuthorizationRequest, useTestApp } from './authorization-request.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { hashToken } from '../../core/token-hash.js';
import { UserStatus } from '../entities/user.entity.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

  describe('sessions', () => {
    it('starts a fresh session for the winning approved poll', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      approve(uuid);
      const existingSessions = new Set(ctx.refreshTokenRepo.rows.map((row) => row.sessionUuid));

      const response = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      const row = ctx.refreshTokenRepo.rows.find((candidate) => candidate.tokenHash === hashToken(response.body.refreshToken));

      expect(row?.sessionUuid).toMatch(UUID_PATTERN);
      expect(existingSessions.has(row!.sessionUuid)).toBe(false);
      expect(row?.startedAt).toBeInstanceOf(Date);
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

  describe('requester status', () => {
    function poll(uuid: string, pollToken: string): request.Test {
      return request(ctx.app.getHttpServer()).post(`/auth/authorization-requests/${uuid}/poll.json`).send({ pollToken });
    }

    it.each([UserStatus.PENDING, UserStatus.DENIED])(
      'answers the winning poll of a %s requester with { status: "denied" }, no session',
      async (status) => {
        const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
        approve(uuid);
        ctx.userRepo.rows[0].status = status;
        const tokenRows = ctx.refreshTokenRepo.rows.length;

        const response = await poll(uuid, pollToken).expect(201);

        expect(response.body).toEqual({ status: 'denied' });
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(ctx.refreshTokenRepo.rows).toHaveLength(tokenRows);
        expect(ctx.authorizationRequestRepo.rows.find((row) => row.uuid === uuid)?.status).toBe('denied');
        expect((await poll(uuid, pollToken).expect(201)).body).toEqual({ status: 'denied' });
      },
    );

    it('lets only one of two simultaneous polls of a pending requester resolve the request, both without a session', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      approve(uuid);
      ctx.userRepo.rows[0].status = UserStatus.PENDING;
      const tokenRows = ctx.refreshTokenRepo.rows.length;

      const [first, second] = await Promise.all([poll(uuid, pollToken), poll(uuid, pollToken)]);

      expect([first.body.status, second.body.status]).not.toContain('approved');
      expect([first.headers['set-cookie'], second.headers['set-cookie']]).toEqual([undefined, undefined]);
      expect(ctx.refreshTokenRepo.rows).toHaveLength(tokenRows);
      expect(ctx.authorizationRequestRepo.rows.find((row) => row.uuid === uuid)?.status).toBe('denied');
    });

    it.each([UserStatus.PENDING, UserStatus.DENIED, UserStatus.APPROVED])(
      'answers create for a %s username identically, saving the request',
      async (status) => {
        ctx.userRepo.rows[0].status = status;

        const response = await request(ctx.app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        expect(Object.keys(response.body).sort()).toEqual(['expiresAt', 'pollToken', 'uuid']);
        expect(ctx.authorizationRequestRepo.rows.find((row) => row.uuid === response.body.uuid)?.userId).toBe(
          ctx.userRepo.rows[0].id,
        );
      },
    );
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
