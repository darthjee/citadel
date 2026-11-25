import OrganizationLoader, {
  buildOrganizationLoadEffect,
} from '../../../../../../../../assets/js/components/resources/organizations/pages/controllers/OrganizationLoader.js';
import OrganizationsClient from '../../../../../../../../assets/js/client/OrganizationsClient.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

const ORG = { id: 5, name: 'Acme', role: 'owner' };

describe('OrganizationLoader', () => {
  let client;
  let callbacks;
  let loader;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['show']);
    client.show.and.resolveTo(ORG);
    callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
    loader = new OrganizationLoader(client);
  });

  it('fetches the organization by id and reports it', async () => {
    await loader.load(5, callbacks);

    expect(client.show).toHaveBeenCalledWith(5);
    expect(callbacks.onLoaded).toHaveBeenCalledWith(ORG);
  });

  it('reports Not-found on a 404', async () => {
    client.show.and.rejectWith(new ApiError(404, 'Not Found', 'NOT_FOUND'));

    await loader.load(5, callbacks);

    expect(callbacks.onNotFound).toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('reports other errors with their message', async () => {
    client.show.and.rejectWith(new ApiError(500, 'boom'));

    await loader.load(5, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith('boom');
  });

  it('reports nothing on an expired session', async () => {
    client.show.and.rejectWith(sessionExpiredError());

    await loader.load(5, callbacks);

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('drops late answers', async () => {
    await loader.load(5, callbacks, () => false);
    client.show.and.rejectWith(new ApiError(404, 'Not Found'));
    await loader.load(5, callbacks, () => false);

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
    expect(callbacks.onNotFound).not.toHaveBeenCalled();
  });

  it('defaults to OrganizationsClient', async () => {
    spyOn(OrganizationsClient, 'show').and.resolveTo(ORG);

    await new OrganizationLoader().load(5, callbacks);

    expect(OrganizationsClient.show).toHaveBeenCalledWith(5);
  });

  describe('buildOrganizationLoadEffect', () => {
    it('loads on run', () => {
      spyOn(loader, 'load').and.resolveTo();

      buildOrganizationLoadEffect(loader, 5, callbacks)();

      expect(loader.load).toHaveBeenCalledWith(5, callbacks, jasmine.any(Function));
    });

    it('turns the liveness check off on cleanup', () => {
      spyOn(loader, 'load').and.resolveTo();

      const cleanup = buildOrganizationLoadEffect(loader, 5, callbacks)();
      const isActive = loader.load.calls.argsFor(0)[2];

      expect(isActive()).toBeTrue();
      cleanup();
      expect(isActive()).toBeFalse();
    });
  });
});
