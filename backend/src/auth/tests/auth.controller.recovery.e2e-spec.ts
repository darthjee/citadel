import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('recover flow', () => {
    describe('for an email that matches an account', () => {
      let response: request.Response;

      beforeEach(async () => {
        response = await request(ctx.app.getHttpServer())
          .post('/auth/recover.json')
          .send({ email: 'darthjee@example.com' })
          .expect(200);
      });

      it('responds 200 { sent: true }', () => {
        expect(response.body).toEqual({ sent: true });
      });

      it('sets the X-Skip-Cache header', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    it('responds 200 { sent: true } for an email that does not match any account', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(response.body).toEqual({ sent: true });
    });

    it('creates a password-reset token only when the email matches an account', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(ctx.passwordResetTokenRepo.rows).toHaveLength(0);

      await request(ctx.app.getHttpServer())
        .post('/auth/recover.json')
        .send({ email: 'darthjee@example.com' })
        .expect(200);

      expect(ctx.passwordResetTokenRepo.rows).toHaveLength(1);
    });
  });

  describe('reset-password flow', () => {
    // Captures the plaintext token from the fired event, standing in for
    // the recovery-email listener that #39 will add — this issue's own
    // code never returns the plaintext token over HTTP.
    async function requestRecoveryToken(email: string): Promise<string> {
      const eventEmitter = ctx.app.get(EventEmitter2);
      const tokenPromise = new Promise<string>((resolve) => {
        eventEmitter.once('password-recovery.requested', (event: { token: string }) => {
          resolve(event.token);
        });
      });

      await request(ctx.app.getHttpServer()).post('/auth/recover.json').send({ email });

      return tokenPromise;
    }

    describe('with a valid token', () => {
      let response: request.Response;

      beforeEach(async () => {
        const token = await requestRecoveryToken('darthjee@example.com');

        response = await request(ctx.app.getHttpServer())
          .post('/auth/reset-password.json')
          .send({ token, password: 'brand-new-password' })
          .expect(200);
      });

      it('responds 200 { reset: true }', () => {
        expect(response.body).toEqual({ reset: true });
      });

      it('lets the user log in with the new password', async () => {
        await loginAs(ctx.app, 'darthjee', 'brand-new-password').expect(201);
      });

      it('sets the X-Skip-Cache header', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    it('revokes the user\'s other refresh tokens on success', async () => {
      const login = await loginAs(ctx.app);
      const token = await requestRecoveryToken('darthjee@example.com');

      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);

      await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });

    it('rejects an unknown token with a 400 BAD_REQUEST error body, not 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token: 'not-a-real-token', password: 'brand-new-password' });

      expectErrorBody(response, { status: 400, code: ErrorCodes.BAD_REQUEST, message: 'Invalid or expired token' });
    });

    it('rejects an already-used token', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');

      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);

      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'yet-another-password' })
        .expect(400);
    });

    it('rejects an expired token', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');
      ctx.passwordResetTokenRepo.rows[ctx.passwordResetTokenRepo.rows.length - 1].expiresAt = new Date(
        Date.now() - 1000,
      );

      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(400);
    });

    it('rejects a too-short password with a 400, without touching the token', async () => {
      const token = await requestRecoveryToken('darthjee@example.com');

      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'short' })
        .expect(400);

      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'brand-new-password' })
        .expect(200);
    });
  });
});
