import { registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { hashToken } from '../../core/token-hash.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('sessions', () => {
    it('persists the refresh token with a fresh session, distinct from other sessions', async () => {
      const before = Date.now();
      const response = await registerUser(ctx.app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);
      const row = ctx.refreshTokenRepo.rows.find((candidate) => candidate.tokenHash === hashToken(response.body.refreshToken));

      expect(row?.sessionUuid).toMatch(UUID_PATTERN);
      expect(row?.startedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(ctx.refreshTokenRepo.rows.filter((candidate) => candidate.sessionUuid === row?.sessionUuid)).toHaveLength(1);
    });
  });

  describe('POST /auth/register.json error bodies', () => {
    it('answers an invalid payload with 400 VALIDATION_FAILED and the message list as details', async () => {
      const response = await registerUser(ctx.app, { username: '', email: 'not-an-email', password: 'short' });

      expectValidationErrorBody(response);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining(['email must be an email', 'password must be longer than or equal to 8 characters']),
      );
    });

    it('answers a taken username with 409 USERNAME_TAKEN', async () => {
      const response = await registerUser(ctx.app, { username: 'darthjee', email: 'other@example.com' });

      expectErrorBody(response, {
        status: 409,
        code: ErrorCodes.USERNAME_TAKEN,
        message: 'username is not available',
      });
    });

    it('answers a taken email with 409 EMAIL_TAKEN', async () => {
      const response = await registerUser(ctx.app, { username: 'someone-else', email: 'darthjee@example.com' });

      expectErrorBody(response, {
        status: 409,
        code: ErrorCodes.EMAIL_TAKEN,
        message: 'email is not available',
      });
    });
  });
});
