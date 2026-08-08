import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  buildTestApp,
  createAuthorizationRequest,
  createInMemoryRepo,
  expectUniformCreateResponse,
  fillCreateLimit,
  login,
  useTestApp,
} from './authorization-request.controller.e2e-test-support.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';

describe('AuthorizationRequestController (e2e)', () => {
  const ctx = useTestApp();

  describe('rate limiting and abuse hardening', () => {
    describe('create — per-IP limit', () => {
      it('rejects the 6th create from the same IP without persisting a row, identically for a known/unknown username', async () => {
        await fillCreateLimit(ctx.app, { username: (i) => `rate-ip-${i}` });

        const rowCountBeforeOverLimit = ctx.authorizationRequestRepo.rows.length;

        const overLimitUnknown = await request(ctx.app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'rate-ip-unknown' })
          .expect(201);

        const overLimitKnown = await request(ctx.app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        expectUniformCreateResponse(overLimitUnknown.body);
        expectUniformCreateResponse(overLimitKnown.body);
        expect(ctx.authorizationRequestRepo.rows.length).toBe(rowCountBeforeOverLimit);
      });
    });

    describe('create — per-username limit', () => {
      const fillUsernameLimit = (username: string): Promise<void> =>
        fillCreateLimit(ctx.app, { username: () => username, ip: (i) => `203.0.113.${i}` });

      it('rejects the 6th create for the same unknown username from a fresh IP, without persisting a row', async () => {
        await fillUsernameLimit('rate-username-unknown');
        const rowCountBeforeOverLimit = ctx.authorizationRequestRepo.rows.length;

        const overLimit = await request(ctx.app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .set('X-Forwarded-For', '203.0.113.99')
          .send({ username: 'rate-username-unknown' })
          .expect(201);

        expectUniformCreateResponse(overLimit.body);
        expect(ctx.authorizationRequestRepo.rows.length).toBe(rowCountBeforeOverLimit);
      });

      it('rejects the 6th create for the same known username from a fresh IP, identically to an unknown username', async () => {
        await fillUsernameLimit('darthjee');
        const rowCountBeforeOverLimit = ctx.authorizationRequestRepo.rows.length;

        const overLimit = await request(ctx.app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .set('X-Forwarded-For', '203.0.113.99')
          .send({ username: 'darthjee' })
          .expect(201);

        expectUniformCreateResponse(overLimit.body);
        expect(ctx.authorizationRequestRepo.rows.length).toBe(rowCountBeforeOverLimit);
      });
    });

    describe('create — concurrent open cap', () => {
      let capApp: INestApplication;
      let capRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;

      beforeEach(async () => {
        ({ app: capApp, authorizationRequestRepo: capRepo } = await buildTestApp({
          CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT: '100',
          CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER: '2',
        }));
      });

      afterEach(async () => {
        await capApp.close();
      });

      it('evicts the oldest open row (flips it to expired) instead of rejecting once the cap is reached', async () => {
        const first = await request(capApp.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        await request(capApp.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        await request(capApp.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee' })
          .expect(201);

        const firstRow = capRepo.rows.find((row) => row.uuid === first.body.uuid);

        expect(firstRow?.status).toBe('expired');
        expect(capRepo.rows.filter((row) => row.status === 'open').length).toBe(2);
      });
    });

    describe('authorize — cool-off lockout', () => {
      let ownerCookie: string;

      beforeEach(async () => {
        ownerCookie = await login(ctx.app, 'darthjee', 'my-password');
      });

      it(
        'locks the row after the configured max wrong-password attempts, rejecting even the correct password with the same uniform message',
        async () => {
          const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

          for (let i = 0; i < 5; i += 1) {
            await request(ctx.app.getHttpServer())
              .post(`/auth/authorization-requests/${uuid}/authorize.json`)
              .set('Cookie', [ownerCookie])
              .send({ password: 'wrong-password' })
              .expect(400);
          }

          const lockedResponse = await request(ctx.app.getHttpServer())
            .post(`/auth/authorization-requests/${uuid}/authorize.json`)
            .set('Cookie', [ownerCookie])
            .send({ password: 'my-password' })
            .expect(400);

          expect(lockedResponse.body.error).toEqual({
            code: ErrorCodes.BAD_REQUEST,
            message: 'Unable to authorize this request',
          });

          const row = ctx.authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);
          expect(row?.status).toBe('open');
        },
        15000,
      );
    });

    describe('DTO length caps', () => {
      it('rejects an oversized username on create with 400', async () => {
        await request(ctx.app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'a'.repeat(256) })
          .expect(400);
      });

      it('rejects an oversized password on authorize with 400', async () => {
        const ownerCookie = await login(ctx.app, 'darthjee', 'my-password');
        const { uuid } = await createAuthorizationRequest(ctx.app, 'darthjee');

        await request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'a'.repeat(129) })
          .expect(400);
      });
    });
  });
});
