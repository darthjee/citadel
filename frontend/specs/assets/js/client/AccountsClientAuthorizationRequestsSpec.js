import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';

describe('AccountsClient authorization requests', () => {
  afterEach(() => {
    AuthSession.clear();
  });

  describe('.createAuthorizationRequest', () => {
    const request = { uuid: 'req-uuid', pollToken: 'poll-token', expiresAt: '2026-09-09T00:05:00.000Z' };

    it('posts the username and resolves with the uuid, poll token and expiry', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(request);

      const response = await AccountsClient.createAuthorizationRequest('foo');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/authorization-requests.json', {
        username: 'foo',
      });
      expect(response).toEqual(request);
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo(request);

      await AccountsClient.createAuthorizationRequest('foo');

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.pollAuthorizationRequest', () => {
    it('posts the poll token to the request-specific poll endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ status: 'open' });

      await AccountsClient.pollAuthorizationRequest('req-uuid', 'poll-token');

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/auth/authorization-requests/req-uuid/poll.json',
        { pollToken: 'poll-token' },
      );
    });

    it('resolves with the status and persists the refresh token on approved', async () => {
      const result = {
        status: 'approved',
        user: { id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false },
        refreshToken: 'refresh-token',
      };
      spyOn(ApiClient, 'postJson').and.resolveTo(result);

      const response = await AccountsClient.pollAuthorizationRequest('req-uuid', 'poll-token');

      expect(response).toEqual(result);
      expect(AuthSession.get()).toBe('refresh-token');
    });

    ['open', 'denied', 'expired', 'logged'].forEach((status) => {
      it(`resolves untouched and leaves the session alone for ${status}`, async () => {
        AuthSession.set('existing-token');
        spyOn(ApiClient, 'postJson').and.resolveTo({ status });

        const response = await AccountsClient.pollAuthorizationRequest('req-uuid', 'poll-token');

        expect(response).toEqual({ status });
        expect(AuthSession.get()).toBe('existing-token');
      });
    });

    it('propagates an ApiError from a wrong uuid or poll token', async () => {
      const error = new Error('not found');
      error.status = 404;
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(
        AccountsClient.pollAuthorizationRequest('bad-uuid', 'poll-token'),
      ).toBeRejectedWith(error);
    });
  });

  describe('.listAuthorizationRequests', () => {
    const requests = [
      {
        uuid: 'req-uuid',
        requestIp: '127.0.0.1',
        requestUserAgent: 'Mozilla/5.0',
        createdAt: '2026-09-09T00:00:00.000Z',
        expiresAt: '2026-09-09T01:00:00.000Z',
      },
    ];

    it('posts an empty body to the mine endpoint and resolves with the requests', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ requests });

      const response = await AccountsClient.listAuthorizationRequests();

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/auth/authorization-requests/mine.json',
        {},
      );
      expect(response).toEqual({ requests });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ requests });

      await AccountsClient.listAuthorizationRequests();

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.authorizeAuthorizationRequest', () => {
    it('posts the password to the request-specific authorize endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ authorized: true });

      await AccountsClient.authorizeAuthorizationRequest('req-uuid', 'secret');

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/auth/authorization-requests/req-uuid/authorize.json',
        { password: 'secret' },
      );
    });

    it('resolves with the parsed response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ authorized: true });

      const response = await AccountsClient.authorizeAuthorizationRequest('req-uuid', 'secret');

      expect(response).toEqual({ authorized: true });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ authorized: true });

      await AccountsClient.authorizeAuthorizationRequest('req-uuid', 'secret');

      expect(AuthSession.get()).toBe('refresh-token');
    });

    it('propagates an ApiError from a wrong password, owner, status, or expired request', async () => {
      const error = new Error('bad request');
      error.status = 400;
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(
        AccountsClient.authorizeAuthorizationRequest('req-uuid', 'wrong'),
      ).toBeRejectedWith(error);
    });
  });

  describe('.denyAuthorizationRequest', () => {
    it('posts an empty body to the request-specific deny endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ denied: true });

      await AccountsClient.denyAuthorizationRequest('req-uuid');

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/auth/authorization-requests/req-uuid/deny.json',
        {},
      );
    });

    it('resolves with the parsed response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ denied: true });

      const response = await AccountsClient.denyAuthorizationRequest('req-uuid');

      expect(response).toEqual({ denied: true });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ denied: true });

      await AccountsClient.denyAuthorizationRequest('req-uuid');

      expect(AuthSession.get()).toBe('refresh-token');
    });

    it('propagates an ApiError from a wrong owner, status, or expired request', async () => {
      const error = new Error('bad request');
      error.status = 400;
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(
        AccountsClient.denyAuthorizationRequest('req-uuid'),
      ).toBeRejectedWith(error);
    });
  });
});
