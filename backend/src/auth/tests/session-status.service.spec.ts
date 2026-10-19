import { RefreshToken, RevokedReason } from '../entities/refresh-token.entity.js';
import { User, UserStatus } from '../entities/user.entity.js';
import { SessionStatusService } from '../session-status.service.js';
import { TokenService } from '../token.service.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

describe('SessionStatusService', () => {
  let userRepository: RepoMock<User>;
  let refreshTokenRepository: RepoMock<RefreshToken>;
  let tokenService: { hashToken: jest.Mock; revokeToken: jest.Mock };
  let service: SessionStatusService;

  const activeToken = { id: 10, userId: 1, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
  const user = {
    id: 1,
    username: 'darthjee',
    email: 'darthjee@example.com',
    isAdmin: false,
    status: UserStatus.APPROVED,
  } as User;
  const ANONYMOUS = { loggedIn: false, isAdmin: false };

  beforeEach(() => {
    userRepository = repoMock<User>();
    refreshTokenRepository = repoMock<RefreshToken>();
    tokenService = {
      hashToken: jest.fn((token: string) => `hashed:${token}`),
      revokeToken: jest.fn(async () => undefined),
    };

    service = new SessionStatusService(
      userRepository as never,
      refreshTokenRepository as never,
      tokenService as unknown as TokenService,
    );
  });

  describe('status', () => {
    describe('when the refresh token is active and the user approved', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('resolves with loggedIn: true and the user isAdmin, without status', async () => {
        const result = await service.status('a-refresh-token');

        expect(result).toEqual({ loggedIn: true, isAdmin: false });
        expect(result).not.toHaveProperty('status');
      });

      it('looks the token up by its hash', async () => {
        await service.status('a-refresh-token');

        expect(refreshTokenRepository.findOneBy).toHaveBeenCalledWith({ tokenHash: 'hashed:a-refresh-token' });
      });

      it('looks the user up by the token row userId', async () => {
        await service.status('a-refresh-token');

        expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      });

      it('does not revoke anything', async () => {
        await service.status('a-refresh-token');

        expect(tokenService.revokeToken).not.toHaveBeenCalled();
        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('when the active token belongs to an approved admin', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue({ ...user, isAdmin: true });
      });

      it('resolves with isAdmin: true', async () => {
        await expect(service.status('a-refresh-token')).resolves.toEqual({ loggedIn: true, isAdmin: true });
      });
    });

    describe('when the active token belongs to a pending user', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue({ ...user, isAdmin: true, status: UserStatus.PENDING });
      });

      it('resolves with the pending answer, never leaking isAdmin', async () => {
        await expect(service.status('a-refresh-token')).resolves.toEqual({
          loggedIn: false,
          isAdmin: false,
          status: 'pending',
        });
      });

      it('keeps the session (no revocation)', async () => {
        await service.status('a-refresh-token');

        expect(tokenService.revokeToken).not.toHaveBeenCalled();
      });
    });

    describe('when the active token belongs to a denied user', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue({ ...user, isAdmin: true, status: UserStatus.DENIED });
      });

      it('resolves with the anonymous answer, byte-for-byte', async () => {
        const denied = await service.status('a-refresh-token');

        refreshTokenRepository.findOneBy.mockResolvedValue(null);
        const unknown = await service.status('unknown-token');

        expect(JSON.stringify(denied)).toBe(JSON.stringify(unknown));
        expect(denied).toEqual(ANONYMOUS);
      });

      it('revokes only that token, with admin_denied', async () => {
        await service.status('a-refresh-token');

        expect(tokenService.revokeToken).toHaveBeenCalledTimes(1);
        expect(tokenService.revokeToken).toHaveBeenCalledWith(10, RevokedReason.ADMIN_DENIED);
      });
    });

    describe('when the token user no longer exists', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('resolves with the anonymous answer', async () => {
        await expect(service.status('a-refresh-token')).resolves.toEqual(ANONYMOUS);
      });
    });

    describe('when the refresh token is unknown', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(null);
      });

      it('resolves with loggedIn: false and isAdmin: false, without throwing', async () => {
        await expect(service.status('unknown-token')).resolves.toEqual(ANONYMOUS);
      });

      it('does not look up the user', async () => {
        await service.status('unknown-token');

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });
    });

    describe('when the refresh token has expired', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, expiresAt: new Date(Date.now() - 1000) });
      });

      it('resolves with loggedIn: false and isAdmin: false', async () => {
        await expect(service.status('expired-token')).resolves.toEqual(ANONYMOUS);
      });
    });

    describe('when the refresh token was already rotated', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({
          ...activeToken,
          revokedAt: new Date(),
          revokedReason: RevokedReason.ROTATED,
        });
      });

      it('resolves with loggedIn: false and isAdmin: false, without throwing', async () => {
        await expect(service.status('revoked-token')).resolves.toEqual(ANONYMOUS);
      });

      it('does not revoke the rest of the token family', async () => {
        await service.status('revoked-token');

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeToken).not.toHaveBeenCalled();
      });
    });
  });
});
