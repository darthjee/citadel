import OrganizationsClient from '../../../../assets/js/client/OrganizationsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';

describe('OrganizationsClient', () => {
  describe('.list', () => {
    it('gets the organizations list', async () => {
      spyOn(ApiClient, 'getJson').and.resolveTo([{ id: 5, name: 'Acme', role: 'owner' }]);

      const orgs = await OrganizationsClient.list();

      expect(ApiClient.getJson).toHaveBeenCalledWith('/orgs.json');
      expect(orgs).toEqual([{ id: 5, name: 'Acme', role: 'owner' }]);
    });
  });

  describe('.create', () => {
    it('posts the name to the organizations endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ id: 6, name: 'Beta', role: 'owner' });

      const org = await OrganizationsClient.create('Beta');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/orgs.json', { name: 'Beta' });
      expect(org).toEqual({ id: 6, name: 'Beta', role: 'owner' });
    });
  });

  describe('.show', () => {
    it('gets one organization by id', async () => {
      spyOn(ApiClient, 'getJson').and.resolveTo({ id: 5, name: 'Acme', role: 'user' });

      const org = await OrganizationsClient.show(5);

      expect(ApiClient.getJson).toHaveBeenCalledWith('/orgs/5.json');
      expect(org).toEqual({ id: 5, name: 'Acme', role: 'user' });
    });
  });

  describe('.rename', () => {
    it('patches the name of one organization', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo({ id: 5, name: 'Renamed', role: 'admin' });

      const org = await OrganizationsClient.rename(5, 'Renamed');

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/orgs/5.json', { name: 'Renamed' });
      expect(org).toEqual({ id: 5, name: 'Renamed', role: 'admin' });
    });
  });

  it('propagates failures', async () => {
    spyOn(ApiClient, 'getJson').and.rejectWith(new Error('boom'));

    await expectAsync(OrganizationsClient.list()).toBeRejectedWithError('boom');
  });
});
