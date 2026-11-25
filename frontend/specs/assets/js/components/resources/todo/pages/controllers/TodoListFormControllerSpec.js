import TodoListFormController from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/TodoListFormController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

describe('TodoListFormController', () => {
  let deps;
  let controller;

  beforeEach(() => {
    deps = {
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      onForbidden: jasmine.createSpy('onForbidden'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['createList', 'renameList']),
    };
    deps.client.createList.and.resolveTo({ id: 12, name: 'Groceries' });
    deps.client.renameList.and.resolveTo({ id: 3, name: 'Renamed' });
    controller = new TodoListFormController(deps);
  });

  describe('.handleCreate', () => {
    it('creates with the trimmed name and goes to the new list', async () => {
      await controller.handleCreate(ORG, { name: ' Groceries ' });

      expect(deps.client.createList).toHaveBeenCalledWith(ORG, 'Groceries');
      expect(deps.setPending).toHaveBeenCalledWith(true);
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/todo/lists/12');
    });

    it('goes to the Personal list in the Personal context', async () => {
      await controller.handleCreate(PERSONAL, { name: 'Groceries' });

      expect(deps.navigate).toHaveBeenCalledWith('#/todo/lists/12');
    });

    it('validates a blank name without calling the API', async () => {
      await controller.handleCreate(ORG, { name: '  ' });

      expect(deps.setFieldErrors).toHaveBeenCalledWith({ name: 'Name is required' });
      expect(deps.client.createList).not.toHaveBeenCalled();
    });

    it('validates a too long name', async () => {
      await controller.handleCreate(ORG, { name: 'a'.repeat(256) });

      expect(deps.setFieldErrors).toHaveBeenCalledWith({ name: 'Name must be at most 255 characters' });
      expect(deps.client.createList).not.toHaveBeenCalled();
    });

    it('shows the backend 400 details on the name field', async () => {
      deps.client.createList.and.rejectWith(new ApiError(
        400, 'name must be shorter', 'VALIDATION_FAILED', ['name must be shorter'],
      ));

      await controller.handleCreate(ORG, { name: 'x' });

      expect(deps.setFieldErrors).toHaveBeenCalledWith({ name: 'name must be shorter' });
      expect(deps.setSubmitError).toHaveBeenCalledWith(null);
      expect(deps.setPending).toHaveBeenCalledWith(false);
      expect(deps.navigate).not.toHaveBeenCalled();
    });

    it('shows 400 details naming no field as the submit error', async () => {
      deps.client.createList.and.rejectWith(new ApiError(
        400, 'x', 'VALIDATION_FAILED', ['property id should not exist'],
      ));

      await controller.handleCreate(ORG, { name: 'x' });

      expect(deps.setSubmitError).toHaveBeenCalledWith('property id should not exist');
    });

    it('shows the message of a 400 without details', async () => {
      deps.client.createList.and.rejectWith(new ApiError(400, 'Bad request'));

      await controller.handleCreate(ORG, { name: 'x' });

      expect(deps.setSubmitError).toHaveBeenCalledWith('Bad request');
    });

    it('reports a 403 as forbidden', async () => {
      deps.client.createList.and.rejectWith(new ApiError(403, 'Forbidden'));

      await controller.handleCreate(ORG, { name: 'x' });

      expect(deps.onForbidden).toHaveBeenCalled();
    });

    it('shows other failures', async () => {
      deps.client.createList.and.rejectWith(new ApiError(500, 'boom'));

      await controller.handleCreate(ORG, { name: 'x' });

      expect(deps.setSubmitError).toHaveBeenCalledWith('boom');
      expect(deps.setPending).toHaveBeenCalledWith(false);
    });

    it('only resets pending on a session-expired rejection', async () => {
      deps.client.createList.and.rejectWith(sessionExpiredError());

      await controller.handleCreate(ORG, { name: 'x' });

      expect(deps.setPending).toHaveBeenCalledWith(false);
      expect(deps.setSubmitError).not.toHaveBeenCalledWith(jasmine.any(String));
    });
  });

  describe('.handleRename', () => {
    it('renames with the trimmed name and goes back to the list', async () => {
      await controller.handleRename(ORG, 3, { name: ' Renamed ' });

      expect(deps.client.renameList).toHaveBeenCalledWith(ORG, 3, 'Renamed');
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/todo/lists/3');
    });

    it('reports a 404 as not found', async () => {
      deps.client.renameList.and.rejectWith(new ApiError(404, 'Not found'));

      await controller.handleRename(ORG, 3, { name: 'x' });

      expect(deps.onNotFound).toHaveBeenCalled();
      expect(deps.navigate).not.toHaveBeenCalled();
    });
  });

  it('uses the real client and navigation by default', () => {
    const rest = { ...deps, client: undefined, navigate: undefined };

    expect(() => new TodoListFormController(rest)).not.toThrow();
  });
});
