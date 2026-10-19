import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import bcrypt from 'bcryptjs';
import { IsNull } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { AuthService, USER_DENIED_MESSAGE } from '../auth.service.js';
import { RefreshToken, RevokedReason } from '../entities/refresh-token.entity.js';
import { User, UserStatus } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';
import { TokenService } from '../token.service.js';
import { UserApprovalConfig } from '../user-approval.config.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

describe('AuthService', () => {
  let userRepository: RepoMock<User>;
  let refreshTokenRepository: RepoMock<RefreshToken>;
  let tokenService: {
    issueTokens: jest.Mock;
    rotateTokens: jest.Mock;
    hashToken: jest.Mock;
    revokeToken: jest.Mock;
    revokeUserTokens: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let passwordResetService: { recover: jest.Mock; resetPassword: jest.Mock };
  let userApprovalConfig: UserApprovalConfig;
  let service: AuthService;

  function buildService(): AuthService {
    return new AuthService(
      userRepository as never,
      refreshTokenRepository as never,
      tokenService as unknown as TokenService,
      eventEmitter as unknown as EventEmitter2,
      passwordResetService as unknown as PasswordResetService,
      userApprovalConfig,
    );
  }

  const activeToken = { id: 10, userId: 1, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };

  function stubExpiredRefreshToken(): void {
    refreshTokenRepository.findOneBy.mockResolvedValue({
      ...activeToken,
      expiresAt: new Date(Date.now() - 1000),
    });
  }

  function stubRevokedRefreshToken(revokedReason: RevokedReason = RevokedReason.ROTATED): void {
    refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, revokedAt: new Date(), revokedReason });
  }

  beforeEach(() => {
    userRepository = repoMock<User>();
    refreshTokenRepository = repoMock<RefreshToken>();
    tokenService = {
      issueTokens: jest.fn(async (user: User) => ({
        user,
        accessToken: 'signed-access-token',
        refreshToken: 'new-refresh-token',
      })),
      rotateTokens: jest.fn(async (user: User) => ({
        user,
        accessToken: 'signed-access-token',
        refreshToken: 'new-refresh-token',
      })),
      hashToken: jest.fn((token: string) => `hashed:${token}`),
      revokeToken: jest.fn(async () => undefined),
      revokeUserTokens: jest.fn(async () => undefined),
    };
    eventEmitter = { emit: jest.fn() };
    passwordResetService = { recover: jest.fn(), resetPassword: jest.fn() };
    userApprovalConfig = new UserApprovalConfig(false);

    service = buildService();
  });

  describe('login', () => {
    let user: User;

    beforeEach(async () => {
      user = {
        id: 1,
        username: 'darthjee',
        email: 'darthjee@example.com',
        passwordDigest: await bcrypt.hash('correct-password', 4),
        isAdmin: false,
        status: UserStatus.APPROVED,
      } as User;
    });

    describe('when the username exists and the password matches', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('resolves with the user and a signed access token', async () => {
        const result = await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(result.user).toBe(user);
        expect(result.accessToken).toBe('signed-access-token');
      });

      it('looks the user up by username', async () => {
        await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(userRepository.findOneBy).toHaveBeenCalledWith({ username: 'darthjee' });
      });

      it('delegates session minting to TokenService with the authenticated user', async () => {
        await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(tokenService.issueTokens).toHaveBeenCalledWith(user);
      });
    });

    describe('when the password is wrong', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(
          service.login({ username: 'darthjee', password: 'wrong-password' }),
        ).rejects.toThrow(new UnauthorizedException('Invalid username or password'));
      });

      it('does not mint a session', async () => {
        await expect(
          service.login({ username: 'darthjee', password: 'wrong-password' }),
        ).rejects.toThrow(UnauthorizedException);

        expect(tokenService.issueTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the username is unknown', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(
          service.login({ username: 'nobody', password: 'whatever' }),
        ).rejects.toThrow(new UnauthorizedException('Invalid username or password'));
      });
    });

    describe('when the user is denied', () => {
      beforeEach(() => {
        user.status = UserStatus.DENIED;
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('answers a wrong password with the same 401 as an unknown user', async () => {
        await expect(
          service.login({ username: 'darthjee', password: 'wrong-password' }),
        ).rejects.toThrow(new UnauthorizedException('Invalid username or password'));
      });

      it('answers the correct password with 403 USER_DENIED', async () => {
        const error = await service
          .login({ username: 'darthjee', password: 'correct-password' })
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as HttpException).getResponse()).toEqual({
          code: ErrorCodes.USER_DENIED,
          message: 'This account has been denied access',
        });
        expect(USER_DENIED_MESSAGE).toBe('This account has been denied access');
      });

      it('does not mint a session', async () => {
        await expect(
          service.login({ username: 'darthjee', password: 'correct-password' }),
        ).rejects.toThrow(ForbiddenException);

        expect(tokenService.issueTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the user is pending', () => {
      beforeEach(() => {
        user.status = UserStatus.PENDING;
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('mints a normal session', async () => {
        const result = await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(tokenService.issueTokens).toHaveBeenCalledWith(user);
        expect(result.accessToken).toBe('signed-access-token');
      });
    });
  });

  // Detailed recover() behavior (token creation, event shape,
  // enumeration-safety) is covered by `password-reset.service.spec.ts`,
  // where that logic actually lives — this only proves the delegation.
  describe('recover', () => {
    it('delegates to PasswordResetService#recover with the given dto', async () => {
      const dto = { email: 'darthjee@example.com' };

      await service.recover(dto);

      expect(passwordResetService.recover).toHaveBeenCalledWith(dto);
    });
  });

  describe('register', () => {
    describe('when the account is created successfully', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue(null);
      });

      it('resolves with the created user and a signed access token', async () => {
        const result = await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        expect(result.user).toEqual(
          expect.objectContaining({ username: 'darthjee', email: 'darthjee@example.com' }),
        );
        expect(result.accessToken).toBe('signed-access-token');
      });

      it('delegates session minting to TokenService with the created user', async () => {
        await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        expect(tokenService.issueTokens).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'darthjee', isAdmin: false }),
        );
      });

      it('creates the user with a hashed password digest', async () => {
        await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        const { passwordDigest } = userRepository.create.mock.calls[0][0];

        expect(passwordDigest).not.toBe('my-password');
        await expect(bcrypt.compare('my-password', passwordDigest)).resolves.toBe(true);
      });

      it('stores the user as approved when approval is not required', async () => {
        await service.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });

        expect(userRepository.create.mock.calls[0][0].status).toBe(UserStatus.APPROVED);
      });

      it('stores the user as pending when approval is required', async () => {
        userApprovalConfig = new UserApprovalConfig(true);
        service = buildService();

        await service.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });

        expect(userRepository.create.mock.calls[0][0].status).toBe(UserStatus.PENDING);
      });

      it('emits a user.registered event with the created user', async () => {
        const result = await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'user.registered',
          expect.objectContaining({
            userId: result.user.id,
            username: 'darthjee',
            email: 'darthjee@example.com',
          }),
        );
      });
    });

    describe('when the username is already taken', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue({ username: 'darthjee', email: 'other@example.com' });
      });

      it('rejects with a 409 ConflictException carrying USERNAME_TAKEN', async () => {
        const error = await service
          .register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' })
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as HttpException).getResponse()).toEqual({
          code: ErrorCodes.USERNAME_TAKEN,
          message: 'username is not available',
        });
      });
    });

    describe('when the email is already taken', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue({ username: 'someone-else', email: 'darthjee@example.com' });
      });

      it('rejects with a 409 ConflictException carrying EMAIL_TAKEN', async () => {
        const error = await service
          .register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' })
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as HttpException).getResponse()).toEqual({
          code: ErrorCodes.EMAIL_TAKEN,
          message: 'email is not available',
        });
      });
    });
  });

  describe('assertAvailableForUpdate', () => {
    describe('when every value is available', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue(null);
      });

      it('resolves', async () => {
        await expect(service.assertAvailableForUpdate(1, 'free', 'free@example.com')).resolves.toBeUndefined();
      });
    });

    describe.each([
      ['username', 'Username already in use', ErrorCodes.USERNAME_TAKEN, ['taken', undefined]],
      ['email', 'Email already in use', ErrorCodes.EMAIL_TAKEN, [undefined, 'taken@example.com']],
    ] as const)('when the %s is taken by another user', (_field, message, code, [username, email]) => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue({ id: 2 });
      });

      it(`rejects with a 409 ConflictException carrying ${code}`, async () => {
        const error = await service.assertAvailableForUpdate(1, username, email).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as HttpException).getStatus()).toBe(409);
        expect((error as HttpException).getResponse()).toEqual({ code, message });
      });
    });
  });

  describe('refresh', () => {
    const user = {
      id: 1,
      username: 'darthjee',
      email: 'darthjee@example.com',
      isAdmin: false,
      status: UserStatus.APPROVED,
    } as User;

    describe('when the active token belongs to a pending user', () => {
      const pending = { ...user, status: UserStatus.PENDING } as User;

      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(pending);
      });

      it('rotates normally', async () => {
        await service.refresh('a-refresh-token');

        expect(tokenService.rotateTokens).toHaveBeenCalledWith(pending, activeToken);
        expect(tokenService.revokeToken).not.toHaveBeenCalled();
      });
    });

    describe('when the active token belongs to a denied user', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue({ ...user, status: UserStatus.DENIED });
      });

      it('rejects with a plain 401', async () => {
        await expect(service.refresh('a-refresh-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('revokes only the presented token, with admin_denied, without replay detection', async () => {
        await expect(service.refresh('a-refresh-token')).rejects.toThrow(UnauthorizedException);

        expect(tokenService.revokeToken).toHaveBeenCalledWith(activeToken.id, RevokedReason.ADMIN_DENIED);
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
        expect(tokenService.rotateTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the refresh token is active', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('resolves with the rotated token pair', async () => {
        const result = await service.refresh('a-refresh-token');

        expect(result.user).toBe(user);
        expect(result.accessToken).toBe('signed-access-token');
        expect(result.refreshToken).not.toBe('a-refresh-token');
      });

      it('delegates the atomic rotation to TokenService with the reloaded user and the presented row', async () => {
        await service.refresh('a-refresh-token');

        expect(tokenService.rotateTokens).toHaveBeenCalledWith(user, activeToken);
        expect(tokenService.issueTokens).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });

      it('propagates a lost rotation race as 401', async () => {
        tokenService.rotateTokens.mockRejectedValue(new UnauthorizedException('Invalid or expired refresh token'));

        await expect(service.refresh('a-refresh-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });
    });

    describe('when the token user no longer exists', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with UnauthorizedException without rotating', async () => {
        await expect(service.refresh('a-refresh-token')).rejects.toThrow(
          new UnauthorizedException('Invalid refresh token'),
        );
        expect(tokenService.rotateTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the refresh token is unknown', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(service.refresh('unknown-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });
    });

    describe('when the refresh token was already rotated', () => {
      beforeEach(() => {
        stubRevokedRefreshToken();
      });

      it('rejects with UnauthorizedException, preventing replay', async () => {
        await expect(service.refresh('reused-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('treats the replay as a compromise signal, revoking every active token with replay_detected', async () => {
        await expect(service.refresh('reused-token')).rejects.toThrow(UnauthorizedException);

        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(
          activeToken.userId,
          RevokedReason.REPLAY_DETECTED,
        );
        expect(tokenService.rotateTokens).not.toHaveBeenCalled();
      });
    });

    describe.each([
      RevokedReason.LOGOUT,
      RevokedReason.PASSWORD_RESET,
      RevokedReason.REPLAY_DETECTED,
      RevokedReason.ADMIN_DENIED,
    ])(
      'when the refresh token was revoked with %s',
      (reason) => {
        beforeEach(() => {
          stubRevokedRefreshToken(reason);
        });

        it('rejects with a plain 401, without replay detection', async () => {
          await expect(service.refresh('revoked-token')).rejects.toThrow(
            new UnauthorizedException('Invalid or expired refresh token'),
          );
          expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
          expect(tokenService.rotateTokens).not.toHaveBeenCalled();
        });
      },
    );

    describe('when an expired refresh token was rotated', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({
          ...activeToken,
          expiresAt: new Date(Date.now() - 1000),
          revokedAt: new Date(),
          revokedReason: RevokedReason.ROTATED,
        });
      });

      it('rejects with 401 before the revocation check, without replay detection', async () => {
        await expect(service.refresh('old-rotated-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the refresh token has expired', () => {
      beforeEach(() => {
        stubExpiredRefreshToken();
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(service.refresh('expired-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('does not treat plain expiry as a compromise signal, leaving the token family untouched', async () => {
        await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });
  });

  describe('logout', () => {
    const sessionUuid = '11111111-2222-4333-8444-555555555555';

    it.each([
      ['an active', { revokedAt: null, revokedReason: null }],
      ['a rotated (stale)', { revokedAt: new Date(), revokedReason: RevokedReason.ROTATED }],
      ['an expired', { expiresAt: new Date(Date.now() - 1000) }],
    ])('revokes every active row of %s token\'s session with logout', async (_label, state) => {
      refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, sessionUuid, ...state });

      await service.logout('a-refresh-token');

      expect(refreshTokenRepository.findOneBy).toHaveBeenCalledWith({ tokenHash: 'hashed:a-refresh-token' });
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: activeToken.userId, sessionUuid, revokedAt: IsNull() },
        { revokedAt: expect.any(Date), revokedReason: RevokedReason.LOGOUT },
      );
    });

    it('does nothing for an unknown token', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(null);

      await expect(service.logout('unknown-token')).resolves.toBeUndefined();

      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
    });
  });

  // Detailed token-validation/rejection-reason behavior is covered by
  // `password-reset.service.spec.ts` — this proves AuthService's own
  // contribution: revoking the user's other sessions on success, and
  // never revoking anything when the token is rejected.
  describe('resetPassword', () => {
    describe('when the token is valid', () => {
      beforeEach(() => {
        passwordResetService.resetPassword.mockResolvedValue(1);
      });

      it('revokes only the active refresh tokens of that user, with password_reset', async () => {
        await service.resetPassword({ token: 'a-token', password: 'new-password' });

        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(1, RevokedReason.PASSWORD_RESET);
      });
    });

    describe('when the token is rejected', () => {
      beforeEach(() => {
        passwordResetService.resetPassword.mockRejectedValue(
          new BadRequestException('Invalid or expired token'),
        );
      });

      it('propagates the BadRequestException', async () => {
        await expect(
          service.resetPassword({ token: 'bad-token', password: 'new-password' }),
        ).rejects.toThrow(new BadRequestException('Invalid or expired token'));
      });

      it('does not revoke any refresh tokens', async () => {
        await expect(
          service.resetPassword({ token: 'bad-token', password: 'new-password' }),
        ).rejects.toThrow(BadRequestException);

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });
  });
});
