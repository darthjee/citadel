import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';

describe('AccountsClient', () => {
  afterEach(() => {
    AuthSession.clear();
  });

  const tokenPairRows = [
    {
      name: '.register',
      call: () => AccountsClient.register({
        username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
      }),
      endpoint: '/auth/register.json',
      payload: {
        username: 'foo',
        email: 'foo@example.com',
        password: 'secret',
        password_confirmation: 'secret',
      },
      refreshToken: 'refresh-token',
    },
    {
      name: '.login',
      call: () => AccountsClient.login({ username: 'foo', password: 'secret' }),
      endpoint: '/auth/login.json',
      payload: { username: 'foo', password: 'secret' },
      refreshToken: 'refresh-token',
    },
    {
      name: '.refresh',
      call: () => AccountsClient.refresh('old-refresh-token'),
      endpoint: '/auth/refresh.json',
      payload: { refreshToken: 'old-refresh-token' },
      refreshToken: 'new-refresh-token',
    },
  ];

  tokenPairRows.forEach(({
    name, call, endpoint, payload, refreshToken,
  }) => {
    describe(name, () => {
      let result;

      beforeEach(() => {
        result = {
          user: { id: 1, username: 'foo', email: 'foo@example.com' },
          refreshToken,
        };
        spyOn(ApiClient, 'postJson').and.resolveTo(result);
      });

      it(`posts the mapped payload to ${endpoint}`, async () => {
        await call();

        expect(ApiClient.postJson).toHaveBeenCalledWith(endpoint, payload);
      });

      it('persists the returned refresh token and resolves with the response', async () => {
        const response = await call();

        expect(response).toEqual(result);
        expect(AuthSession.get()).toBe(refreshToken);
      });
    });
  });

  describe('.logout', () => {
    it('sends the refresh token to the logoff endpoint', async () => {
      spyOn(ApiClient, 'deleteJson').and.resolveTo();

      await AccountsClient.logout('refresh-token');

      expect(ApiClient.deleteJson).toHaveBeenCalledWith('/auth/logoff.json', {
        refreshToken: 'refresh-token',
      });
    });

    it('clears the stored refresh token on success', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'deleteJson').and.resolveTo();

      await AccountsClient.logout('refresh-token');

      expect(AuthSession.get()).toBeNull();
    });

    it('clears the stored refresh token even when the request fails', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'deleteJson').and.rejectWith(new Error('network error'));

      await expectAsync(AccountsClient.logout('refresh-token')).toBeRejected();

      expect(AuthSession.get()).toBeNull();
    });
  });

  describe('.status', () => {
    it('posts the refresh token to the status endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: true, isAdmin: false });

      await AccountsClient.status('refresh-token');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/status.json', {
        refreshToken: 'refresh-token',
      });
    });

    it('resolves with the parsed loggedIn/isAdmin response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: false, isAdmin: false });

      const response = await AccountsClient.status('refresh-token');

      expect(response).toEqual({ loggedIn: false, isAdmin: false });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: false, isAdmin: false });

      await AccountsClient.status('refresh-token');

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.recover', () => {
    it('posts the email to the recover endpoint and resolves with the parsed response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      const response = await AccountsClient.recover('foo@example.com');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/recover.json', {
        email: 'foo@example.com',
      });
      expect(response).toEqual({ sent: true });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      await AccountsClient.recover('foo@example.com');

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.resetPassword', () => {
    it('posts the token and password fields to the reset-password endpoint, mapping to snake_case', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ reset: true });

      await AccountsClient.resetPassword({
        token: 'reset-token', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/reset-password.json', {
        token: 'reset-token',
        password: 'secret',
        password_confirmation: 'secret',
      });
    });

    it('resolves with the parsed response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ reset: true });

      const response = await AccountsClient.resetPassword({
        token: 'reset-token', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(response).toEqual({ reset: true });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ reset: true });

      await AccountsClient.resetPassword({
        token: 'reset-token', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.updateAccount', () => {
    it('patches the current password and every filled-in field to the account endpoint', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo({ username: 'newname', email: 'foo@example.com' });

      await AccountsClient.updateAccount({
        currentPassword: 'secret', username: 'newname', email: 'foo@example.com', newPassword: 'longenough',
      });

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/auth/account.json', {
        currentPassword: 'secret',
        username: 'newname',
        email: 'foo@example.com',
        newPassword: 'longenough',
      });
    });

    it('omits username, email, and newPassword when not provided', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo({ username: 'foo', email: 'foo@example.com' });

      await AccountsClient.updateAccount({ currentPassword: 'secret' });

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/auth/account.json', {
        currentPassword: 'secret',
      });
    });

    it('resolves with the updated username and email', async () => {
      const result = { username: 'newname', email: 'foo@example.com' };
      spyOn(ApiClient, 'patchJson').and.resolveTo(result);

      const response = await AccountsClient.updateAccount({ currentPassword: 'secret', username: 'newname' });

      expect(response).toEqual(result);
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'patchJson').and.resolveTo({ username: 'foo', email: 'foo@example.com' });

      await AccountsClient.updateAccount({ currentPassword: 'secret', username: 'newname' });

      expect(AuthSession.get()).toBe('refresh-token');
    });

    it('propagates an ApiError from a wrong current password or duplicate field', async () => {
      const error = new Error('Invalid current password');
      error.status = 400;
      spyOn(ApiClient, 'patchJson').and.rejectWith(error);

      await expectAsync(
        AccountsClient.updateAccount({ currentPassword: 'wrong', username: 'newname' }),
      ).toBeRejectedWith(error);
    });
  });
});
