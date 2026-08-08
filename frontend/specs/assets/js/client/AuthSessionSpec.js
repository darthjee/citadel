import AuthSession from '../../../../assets/js/client/AuthSession.js';

describe('AuthSession', () => {
  afterEach(() => {
    AuthSession.clear();
  });

  describe('.get', () => {
    it('returns null when no token is stored', () => {
      expect(AuthSession.get()).toBeNull();
    });

    it('returns the stored token', () => {
      AuthSession.set('token-123');

      expect(AuthSession.get()).toBe('token-123');
    });
  });

  describe('.set', () => {
    it('persists the token so it can be read back', () => {
      AuthSession.set('token-456');

      expect(AuthSession.get()).toBe('token-456');
    });
  });

  describe('.clear', () => {
    it('removes the stored token', () => {
      AuthSession.set('token-789');

      AuthSession.clear();

      expect(AuthSession.get()).toBeNull();
    });
  });

  describe('.isLoggedIn', () => {
    it('returns false when no token is stored', () => {
      expect(AuthSession.isLoggedIn()).toBe(false);
    });

    it('returns true when a token is stored', () => {
      AuthSession.set('token-abc');

      expect(AuthSession.isLoggedIn()).toBe(true);
    });
  });
});
