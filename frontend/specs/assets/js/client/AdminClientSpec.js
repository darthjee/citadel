import AdminClient from '../../../../assets/js/client/AdminClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';

describe('AdminClient', () => {
  describe('.searchUsers', () => {
    it('posts the search term to the admin users search endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ users: [] });

      await AdminClient.searchUsers('foo');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/admin/users/search.json', { q: 'foo' });
    });

    it('resolves with the parsed users response', async () => {
      const users = [{
        id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false, createdAt: '2026-01-01',
      }];
      spyOn(ApiClient, 'postJson').and.resolveTo({ users });

      const response = await AdminClient.searchUsers('foo');

      expect(response).toEqual({ users });
    });

    it('allows an omitted search term to list every account', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ users: [] });

      await AdminClient.searchUsers();

      expect(ApiClient.postJson).toHaveBeenCalledWith('/admin/users/search.json', { q: undefined });
    });
  });

  describe('.generateRecoveryLink', () => {
    it('posts to the recovery-link endpoint for the given user', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ resetUrl: 'https://example.com/reset?token=abc' });

      await AdminClient.generateRecoveryLink(42);

      expect(ApiClient.postJson).toHaveBeenCalledWith('/admin/users/42/recovery-link.json', {});
    });

    it('resolves with the parsed resetUrl response', async () => {
      const result = { resetUrl: 'https://example.com/reset?token=abc' };
      spyOn(ApiClient, 'postJson').and.resolveTo(result);

      const response = await AdminClient.generateRecoveryLink(42);

      expect(response).toEqual(result);
    });
  });

  describe('.sendRecoveryEmail', () => {
    it('posts to the send-recovery-email endpoint for the given user', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      await AdminClient.sendRecoveryEmail(42);

      expect(ApiClient.postJson).toHaveBeenCalledWith('/admin/users/42/send-recovery-email.json', {});
    });

    it('resolves with the parsed sent response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      const response = await AdminClient.sendRecoveryEmail(42);

      expect(response).toEqual({ sent: true });
    });
  });

  describe('.editUser', () => {
    const user = {
      id: 42, username: 'foo', email: 'foo@example.com', isAdmin: false, createdAt: '2026-01-01',
    };

    it('posts only the defined fields to the edit endpoint for the given user', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ user });

      await AdminClient.editUser(42, { username: 'foo' });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/admin/users/42/edit.json', { username: 'foo' });
    });

    it('posts every defined field together', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ user });

      await AdminClient.editUser(42, { username: 'foo', email: 'foo@example.com', newPassword: 'longenough' });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/admin/users/42/edit.json', {
        username: 'foo', email: 'foo@example.com', newPassword: 'longenough',
      });
    });

    it('omits fields that were not provided', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ user });

      await AdminClient.editUser(42, {});

      expect(ApiClient.postJson).toHaveBeenCalledWith('/admin/users/42/edit.json', {});
    });

    it('resolves with the parsed user response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ user });

      const response = await AdminClient.editUser(42, { username: 'foo' });

      expect(response).toEqual({ user });
    });
  });
});
