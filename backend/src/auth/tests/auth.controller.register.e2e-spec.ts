import { registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

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
