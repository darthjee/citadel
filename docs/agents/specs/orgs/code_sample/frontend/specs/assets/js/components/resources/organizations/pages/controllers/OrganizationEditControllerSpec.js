import OrganizationEditController from '../../../../../../../../assets/js/components/resources/organizations/pages/controllers/OrganizationEditController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';

describe('OrganizationEditController', () => {
  let deps;
  let controller;

  beforeEach(() => {
    deps = {
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      refreshOrgs: jasmine.createSpy('refreshOrgs').and.resolveTo(),
      navigate: jasmine.createSpy('navigate'),
      onNotFound: jasmine.createSpy('onNotFound'),
      client: jasmine.createSpyObj('client', ['rename']),
    };
    deps.client.rename.and.resolveTo({ id: 5, name: 'New', role: 'owner' });
    controller = new OrganizationEditController(deps);
  });

  it('renames with the trimmed name, refreshes the list and goes back to the overview', async () => {
    await controller.handleSubmit(5, { name: ' New ' });

    expect(deps.client.rename).toHaveBeenCalledWith(5, 'New');
    expect(deps.refreshOrgs).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5');
  });

  it('validates the name', async () => {
    await controller.handleSubmit(5, { name: ' ' });

    expect(deps.setFieldErrors).toHaveBeenCalledWith({ name: 'Name is required' });
    expect(deps.client.rename).not.toHaveBeenCalled();
  });

  it('shows the backend 400 message', async () => {
    deps.client.rename.and.rejectWith(new ApiError(400, 'bad name'));

    await controller.handleSubmit(5, { name: 'New' });

    expect(deps.setSubmitError).toHaveBeenCalledWith('bad name');
    expect(deps.setPending.calls.mostRecent().args[0]).toBeFalse();
  });

  it('shows Not-found on a 404', async () => {
    deps.client.rename.and.rejectWith(new ApiError(404, 'Not Found'));

    await controller.handleSubmit(5, { name: 'New' });

    expect(deps.onNotFound).toHaveBeenCalled();
    expect(deps.setSubmitError).not.toHaveBeenCalledWith('Not Found');
  });

  it('shows the permission message on a 403', async () => {
    deps.client.rename.and.rejectWith(new ApiError(403, 'Forbidden', 'FORBIDDEN'));

    await controller.handleSubmit(5, { name: 'New' });

    expect(deps.setSubmitError).toHaveBeenCalledWith("You don't have permission to do this");
    expect(deps.setSubmitError).not.toHaveBeenCalledWith('Forbidden');
    expect(deps.setPending.calls.mostRecent().args[0]).toBeFalse();
    expect(deps.onNotFound).not.toHaveBeenCalled();
  });
});
