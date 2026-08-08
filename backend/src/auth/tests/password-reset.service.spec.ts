import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import bcrypt from 'bcryptjs';
import { PasswordResetToken } from '../entities/password-reset-token.entity.js';
import { User } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

describe('PasswordResetService', () => {
  let userRepository: RepoMock<User>;
  let passwordResetTokenRepository: RepoMock<PasswordResetToken>;
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };
  let logger: { info: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let service: PasswordResetService;

  beforeEach(() => {
    userRepository = repoMock<User>();
    passwordResetTokenRepository = repoMock<PasswordResetToken>();
    eventEmitter = { emit: jest.fn() };
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'FRONTEND_BASE_URL') {
          return 'http://localhost:3000';
        }

        return defaultValue;
      }),
    };
    logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

    service = new PasswordResetService(
      userRepository as never,
      passwordResetTokenRepository as never,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService,
      logger as never,
    );
  });

  describe('recover', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    it('logs that a password recovery was requested', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await service.recover({ email: 'nobody@example.com' });

      expect(logger.info).toHaveBeenCalledWith('password recovery requested', {
        context: 'PasswordResetService',
      });
    });

    describe('when the email matches an account', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('creates a password-reset token hashed for that user', async () => {
        await service.recover({ email: 'darthjee@example.com' });

        expect(passwordResetTokenRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 1, tokenHash: expect.any(String), usedAt: null }),
        );
      });

      it('emits a password-recovery.requested event with the reset URL', async () => {
        await service.recover({ email: 'darthjee@example.com' });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'password-recovery.requested',
          expect.objectContaining({
            userId: 1,
            token: expect.any(String),
            resetUrl: expect.stringMatching(/^http:\/\/localhost:3000\/#\/recover-password\?token=.+$/),
            email: 'darthjee@example.com',
          }),
        );
      });

      it('never persists the plaintext token', async () => {
        await service.recover({ email: 'darthjee@example.com' });

        const savedTokenHash = passwordResetTokenRepository.save.mock.calls[0][0].tokenHash;
        const emittedToken = eventEmitter.emit.mock.calls[0][1].token;

        expect(savedTokenHash).not.toBe(emittedToken);
      });

      it('logs that the recovery user was found', async () => {
        await service.recover({ email: 'darthjee@example.com' });

        expect(logger.info).toHaveBeenCalledWith('password recovery user found', {
          context: 'PasswordResetService',
          email: 'darthjee@example.com',
          userId: 1,
        });
      });
    });

    describe('when the email does not match an account', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('resolves without throwing', async () => {
        await expect(service.recover({ email: 'nobody@example.com' })).resolves.toBeUndefined();
      });

      it('creates no password-reset token', async () => {
        await service.recover({ email: 'nobody@example.com' });

        expect(passwordResetTokenRepository.save).not.toHaveBeenCalled();
      });

      it('emits no event', async () => {
        await service.recover({ email: 'nobody@example.com' });

        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });

      it('logs that the recovery user was not found', async () => {
        await service.recover({ email: 'nobody@example.com' });

        expect(logger.info).toHaveBeenCalledWith('password recovery user not found', {
          context: 'PasswordResetService',
          email: 'nobody@example.com',
        });
      });
    });
  });

  describe('issueToken', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    it('creates a password-reset token hashed for that user', async () => {
      await service.issueToken(user);

      expect(passwordResetTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, tokenHash: expect.any(String), usedAt: null }),
      );
    });

    it('resolves with the plaintext token and a matching reset URL', async () => {
      const result = await service.issueToken(user);

      expect(result.resetUrl).toBe(`http://localhost:3000/#/recover-password?token=${result.token}`);
    });

    it('never persists the plaintext token', async () => {
      const result = await service.issueToken(user);

      const savedTokenHash = passwordResetTokenRepository.save.mock.calls[0][0].tokenHash;

      expect(savedTokenHash).not.toBe(result.token);
    });

    it('does not emit any event', async () => {
      await service.issueToken(user);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const activeToken = {
      id: 10,
      userId: 1,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    describe('when the token is active', () => {
      beforeEach(() => {
        passwordResetTokenRepository.findOneBy.mockResolvedValue(activeToken);
      });

      it('resolves with the token owner\'s user id', async () => {
        await expect(
          service.resetPassword({ token: 'a-token', password: 'new-password' }),
        ).resolves.toBe(1);
      });

      it('updates the user with a freshly hashed password digest', async () => {
        await service.resetPassword({ token: 'a-token', password: 'new-password' });

        const [userId, { passwordDigest }] = userRepository.update.mock.calls[0];

        expect(userId).toBe(1);
        expect(passwordDigest).not.toBe('new-password');
        await expect(bcrypt.compare('new-password', passwordDigest)).resolves.toBe(true);
      });

      it('marks the token used', async () => {
        await service.resetPassword({ token: 'a-token', password: 'new-password' });

        expect(passwordResetTokenRepository.update).toHaveBeenCalledWith(10, {
          usedAt: expect.any(Date),
        });
      });
    });

    describe('when the token is unknown', () => {
      beforeEach(() => {
        passwordResetTokenRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with BadRequestException', async () => {
        await expect(
          service.resetPassword({ token: 'unknown-token', password: 'new-password' }),
        ).rejects.toThrow(new BadRequestException('Invalid or expired token'));
      });
    });

    describe('when the token was already used', () => {
      beforeEach(() => {
        passwordResetTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, usedAt: new Date() });
      });

      it('rejects with the same BadRequestException, preventing replay', async () => {
        await expect(
          service.resetPassword({ token: 'used-token', password: 'new-password' }),
        ).rejects.toThrow(new BadRequestException('Invalid or expired token'));
      });
    });

    describe('when the token has expired', () => {
      beforeEach(() => {
        passwordResetTokenRepository.findOneBy.mockResolvedValue({
          ...activeToken,
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('rejects with the same BadRequestException', async () => {
        await expect(
          service.resetPassword({ token: 'expired-token', password: 'new-password' }),
        ).rejects.toThrow(new BadRequestException('Invalid or expired token'));
      });
    });
  });
});
