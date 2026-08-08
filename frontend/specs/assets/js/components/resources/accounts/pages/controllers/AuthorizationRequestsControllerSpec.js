import AuthorizationRequestsController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';

describe('AuthorizationRequestsController', () => {
  let setRequests;
  let setLoadError;
  let setRowState;
  let client;

  const requests = [{
    uuid: 'req-uuid',
    requestIp: '127.0.0.1',
    requestUserAgent: 'Mozilla/5.0',
    createdAt: '2026-09-09T00:00:00.000Z',
    expiresAt: '2026-09-09T01:00:00.000Z',
  }];

  beforeEach(() => {
    setRequests = jasmine.createSpy('setRequests');
    setLoadError = jasmine.createSpy('setLoadError');
    setRowState = jasmine.createSpy('setRowState');
    client = jasmine.createSpyObj('client', [
      'listAuthorizationRequests',
      'authorizeAuthorizationRequest',
      'denyAuthorizationRequest',
    ]);
  });

  const buildController = () => new AuthorizationRequestsController(
    setRequests,
    setLoadError,
    setRowState,
    client,
  );

  describe('#load', () => {
    it('stores the returned requests and clears the load error', async () => {
      client.listAuthorizationRequests.and.resolveTo({ requests });
      const controller = buildController();

      await controller.load();

      expect(setRequests).toHaveBeenCalledWith(requests);
      expect(setLoadError).toHaveBeenCalledWith(null);
    });

    it('sets a load error when the request fails', async () => {
      client.listAuthorizationRequests.and.rejectWith(new Error('network error'));
      const controller = buildController();

      await controller.load();

      expect(setLoadError).toHaveBeenCalledWith('network error');
      expect(setRequests).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.listAuthorizationRequests.and.resolveTo(undefined);
      const controller = buildController();

      await controller.load();

      expect(setRequests).not.toHaveBeenCalled();
      expect(setLoadError).not.toHaveBeenCalled();
    });
  });

  const itBehavesLikeRowAction = ({
    stub, act, args, successResponse,
    errorArgs, errorMessage, rowStateBefore, rowStateAfter,
  }) => {
    it('clears the row error and reloads the list on success', async () => {
      stub(client).and.resolveTo(successResponse);
      client.listAuthorizationRequests.and.resolveTo({ requests });
      const controller = buildController();

      await act(controller, ...args);

      expect(stub(client)).toHaveBeenCalledWith(...args);
      const updater = setRowState.calls.first().args[0];
      expect(updater(new Map())).toEqual(new Map([['req-uuid', { error: null }]]));
      expect(client.listAuthorizationRequests).toHaveBeenCalled();
      expect(setRequests).toHaveBeenCalledWith(requests);
    });

    it('stores the error against the row and does not reload on a 400', async () => {
      stub(client).and.rejectWith(new ApiError(400, errorMessage));
      const controller = buildController();

      await act(controller, ...errorArgs);

      const updater = setRowState.calls.mostRecent().args[0];
      expect(updater(rowStateBefore)).toEqual(rowStateAfter);
      expect(client.listAuthorizationRequests).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      stub(client).and.resolveTo(undefined);
      const controller = buildController();

      await act(controller, ...args);

      expect(setRowState).not.toHaveBeenCalled();
      expect(client.listAuthorizationRequests).not.toHaveBeenCalled();
    });
  };

  describe('#authorize', () => {
    itBehavesLikeRowAction({
      stub: (c) => c.authorizeAuthorizationRequest,
      act: (controller, ...args) => controller.authorize(...args),
      args: ['req-uuid', 'secret'],
      successResponse: { authorized: true },
      errorArgs: ['req-uuid', 'wrong'],
      errorMessage: 'Invalid password',
      rowStateBefore: new Map([['req-uuid', { open: true, password: 'wrong' }]]),
      rowStateAfter: new Map([
        ['req-uuid', { open: true, password: 'wrong', error: 'Invalid password' }],
      ]),
    });
  });

  describe('#deny', () => {
    itBehavesLikeRowAction({
      stub: (c) => c.denyAuthorizationRequest,
      act: (controller, ...args) => controller.deny(...args),
      args: ['req-uuid'],
      successResponse: { denied: true },
      errorArgs: ['req-uuid'],
      errorMessage: 'Request already resolved',
      rowStateBefore: new Map(),
      rowStateAfter: new Map([['req-uuid', { error: 'Request already resolved' }]]),
    });
  });

  describe('#patchRow', () => {
    const applyPatch = (current, uuid, patch) => {
      buildController().patchRow(uuid, patch);
      const updater = setRowState.calls.mostRecent().args[0];

      return updater(current);
    };

    it('merges the patch into an existing row, keeping its other fields', () => {
      const current = new Map([['req-uuid', { open: true, password: 'secret', error: 'old' }]]);

      expect(applyPatch(current, 'req-uuid', { error: null })).toEqual(
        new Map([['req-uuid', { open: true, password: 'secret', error: null }]]),
      );
    });

    it('creates the row when it does not exist yet', () => {
      const current = new Map([['other-uuid', { open: true }]]);

      expect(applyPatch(current, 'req-uuid', { open: true })).toEqual(new Map([
        ['other-uuid', { open: true }],
        ['req-uuid', { open: true }],
      ]));
    });

    it('returns a new Map without mutating the current one', () => {
      const current = new Map([['req-uuid', { open: false }]]);

      const result = applyPatch(current, 'req-uuid', { open: true });

      expect(result).not.toBe(current);
      expect(current).toEqual(new Map([['req-uuid', { open: false }]]));
    });
  });
});
