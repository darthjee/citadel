import OrganizationNewController from '../../../../../../../../assets/js/components/resources/organizations/pages/controllers/OrganizationNewController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

const ORG = { id: 7, name: 'Acme', role: 'owner' };

describe('OrganizationNewController', () => {
  let deps;
  let controller;

  beforeEach(() => {
    deps = {
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      refreshOrgs: jasmine.createSpy('refreshOrgs').and.resolveTo(),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['create']),
    };
    deps.client.create.and.resolveTo(ORG);
    controller = new OrganizationNewController(deps);
  });

  describe('validation', () => {
    [
      ['an empty name', '', 'Name is required'],
      ['a whitespace-only name', '   ', 'Name is required'],
      ['256 code points', 'a'.repeat(256), 'Name must be at most 255 characters'],
    ].forEach(([label, name, message]) => {
      it(`rejects ${label} without a request`, async () => {
        await controller.handleSubmit({ name });

        expect(deps.setFieldErrors).toHaveBeenCalledWith({ name: message });
        expect(deps.client.create).not.toHaveBeenCalled();
        expect(deps.setPending).not.toHaveBeenCalled();
      });
    });
  });

  describe('on success', () => {
    it('creates with the trimmed name while pending', async () => {
      await controller.handleSubmit({ name: '  Acme  ' });

      expect(deps.setFieldErrors).toHaveBeenCalledWith({});
      expect(deps.setPending).toHaveBeenCalledWith(true);
      expect(deps.client.create).toHaveBeenCalledWith('Acme');
    });

    it('refreshes the org list then navigates to the overview', async () => {
      const log = [];

      deps.refreshOrgs.and.callFake(async () => log.push('refresh'));
      deps.navigate.and.callFake((hash) => log.push(hash));

      await controller.handleSubmit({ name: 'Acme' });

      expect(log).toEqual(['refresh', '#/orgs/7']);
    });
  });

  describe('on failure', () => {
    it('shows the backend 400 message and resets pending', async () => {
      deps.client.create.and.rejectWith(new ApiError(400, 'name must not contain control characters'));

      await controller.handleSubmit({ name: 'Acme' });

      expect(deps.setSubmitError).toHaveBeenCalledWith('name must not contain control characters');
      expect(deps.setPending.calls.mostRecent().args[0]).toBeFalse();
      expect(deps.navigate).not.toHaveBeenCalled();
    });

    it('does not navigate on an expired session', async () => {
      deps.client.create.and.rejectWith(sessionExpiredError());

      await controller.handleSubmit({ name: 'Acme' });

      expect(deps.setSubmitError).not.toHaveBeenCalledWith(jasmine.any(String));
      expect(deps.navigate).not.toHaveBeenCalled();
      expect(deps.refreshOrgs).not.toHaveBeenCalled();
      expect(deps.setPending.calls.mostRecent().args[0]).toBeFalse();
    });
  });

  describe('with the default navigation', () => {
    afterEach(() => {
      uninstallFakeWindow();
    });

    it('sets window.location.hash', async () => {
      const fakeWindow = installFakeWindow({ location: { hash: '#/orgs/new' } });
      const { navigate, ...rest } = deps;

      expect(navigate).toBeDefined();
      await new OrganizationNewController(rest).handleSubmit({ name: 'Acme' });

      expect(fakeWindow.location.hash).toBe('#/orgs/7');
    });

    it('is a no-op without a window', async () => {
      const { navigate, ...rest } = deps;

      expect(navigate).toBeDefined();
      await expectAsync(new OrganizationNewController(rest).handleSubmit({ name: 'Acme' })).toBeResolved();
    });
  });
});
