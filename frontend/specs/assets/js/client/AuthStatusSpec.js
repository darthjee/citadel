import AuthStatus from '../../../../assets/js/client/AuthStatus.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';
import AuthEvents from '../../../../assets/js/client/AuthEvents.js';

describe('AuthStatus', () => {
  let client;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['status']);
    spyOn(AuthEvents, 'emit');
  });

  afterEach(() => {
    AuthSession.clear();
  });

  describe('.refresh', () => {
    describe('when there is no stored token', () => {
      it('makes no request', async () => {
        await AuthStatus.refresh(client);

        expect(client.status).not.toHaveBeenCalled();
      });

      it('emits logged-out, not admin, not pending', async () => {
        await AuthStatus.refresh(client);

        expect(AuthEvents.emit).toHaveBeenCalledWith(false, false, false);
      });
    });

    describe('when the stored token is still active', () => {
      beforeEach(() => {
        AuthSession.set('refresh-token');
        client.status.and.resolveTo({ loggedIn: true, isAdmin: true });
      });

      it('checks the stored token', async () => {
        await AuthStatus.refresh(client);

        expect(client.status).toHaveBeenCalledWith('refresh-token');
      });

      it('keeps the token', async () => {
        await AuthStatus.refresh(client);

        expect(AuthSession.get()).toBe('refresh-token');
      });

      it('emits logged-in with the admin flag', async () => {
        await AuthStatus.refresh(client);

        expect(AuthEvents.emit).toHaveBeenCalledWith(true, true, false);
      });

      it('emits a non-admin login when isAdmin is false', async () => {
        client.status.and.resolveTo({ loggedIn: true, isAdmin: false });

        await AuthStatus.refresh(client);

        expect(AuthEvents.emit).toHaveBeenCalledWith(true, false, false);
      });
    });

    describe('when the user is pending approval', () => {
      beforeEach(() => {
        AuthSession.set('refresh-token');
        client.status.and.resolveTo({ loggedIn: false, isAdmin: false, status: 'pending' });
      });

      it('keeps the token', async () => {
        await AuthStatus.refresh(client);

        expect(AuthSession.get()).toBe('refresh-token');
      });

      it('emits logged-out with pending', async () => {
        await AuthStatus.refresh(client);

        expect(AuthEvents.emit).toHaveBeenCalledWith(false, false, true);
      });
    });

    describe('when the stored token is no longer active', () => {
      beforeEach(() => {
        AuthSession.set('refresh-token');
        client.status.and.resolveTo({ loggedIn: false, isAdmin: false });
      });

      it('clears the token', async () => {
        await AuthStatus.refresh(client);

        expect(AuthSession.get()).toBeNull();
      });

      it('emits logged-out, not pending', async () => {
        await AuthStatus.refresh(client);

        expect(AuthEvents.emit).toHaveBeenCalledWith(false, false, false);
      });
    });

    describe('when the request fails', () => {
      it('propagates the error and keeps the token', async () => {
        AuthSession.set('refresh-token');
        client.status.and.rejectWith(new Error('network error'));

        await expectAsync(AuthStatus.refresh(client)).toBeRejectedWithError('network error');
        expect(AuthSession.get()).toBe('refresh-token');
        expect(AuthEvents.emit).not.toHaveBeenCalled();
      });
    });
  });
});
