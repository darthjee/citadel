import AwaitingApprovalController, {
  CHECK_FAILED_MESSAGE,
} from '../../../../../../../assets/js/components/common/awaitingApproval/controllers/AwaitingApprovalController.js';
import AuthStatus from '../../../../../../../assets/js/client/AuthStatus.js';

describe('AwaitingApprovalController', () => {
  let setError;
  let onLogout;
  let client;
  let controller;

  beforeEach(() => {
    setError = jasmine.createSpy('setError');
    onLogout = jasmine.createSpy('onLogout').and.resolveTo();
    client = jasmine.createSpyObj('client', ['status']);
    controller = new AwaitingApprovalController(setError, onLogout, client);
  });

  describe('#checkAgain', () => {
    it('refreshes the status through AuthStatus with its client', async () => {
      spyOn(AuthStatus, 'refresh').and.resolveTo();

      await controller.checkAgain();

      expect(AuthStatus.refresh).toHaveBeenCalledOnceWith(client);
    });

    it('clears the error before checking', async () => {
      spyOn(AuthStatus, 'refresh').and.resolveTo();

      await controller.checkAgain();

      expect(setError).toHaveBeenCalledOnceWith(null);
    });

    it('shows the error text when the check fails', async () => {
      spyOn(AuthStatus, 'refresh').and.rejectWith(new Error('network down'));

      await controller.checkAgain();

      expect(setError).toHaveBeenCalledWith(CHECK_FAILED_MESSAGE);
      expect(CHECK_FAILED_MESSAGE).toBe('Could not check your account status, please try again.');
    });

    it('clears the error again on retry', async () => {
      spyOn(AuthStatus, 'refresh').and.rejectWith(new Error('network down'));
      await controller.checkAgain();
      AuthStatus.refresh.and.resolveTo();
      setError.calls.reset();

      await controller.checkAgain();

      expect(setError).toHaveBeenCalledOnceWith(null);
    });
  });

  describe('#logout', () => {
    it('calls the existing logout handler with the event', async () => {
      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      await controller.logout(event);

      expect(onLogout).toHaveBeenCalledOnceWith(event);
    });
  });
});
