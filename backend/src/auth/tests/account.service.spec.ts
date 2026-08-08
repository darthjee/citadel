import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { LockedException } from '../../core/locked.exception.js';
import { AccountEditAbuseGuardService } from '../account-edit-abuse-guard.service.js';
import { AccountService } from '../account.service.js';
import { AuthService } from '../auth.service.js';
import { User } from '../entities/user.entity.js';
import { UserUpdateService } from '../user-update.service.js';

type RepoMock<T extends object> = {
  findOneBy: jest.Mock;
  save: jest.Mock;
} & Partial<T>;

function repoMock<T extends object>(): RepoMock<T> {
  return {
    findOneBy: jest.fn(),
    save: jest.fn(async (entity) => entity),
  } as RepoMock<T>;
}

describe('AccountService', () => {
  let userRepository: RepoMock<User>;
  let authService: { assertAvailableForUpdate: jest.Mock };
  let accountEditAbuseGuardService: {
    isLockedOut: jest.Mock;
    registerFailure: jest.Mock;
    reset: jest.Mock;
  };
  let service: AccountService;
  let user: User;

  beforeEach(async () => {
    user = {
      id: 1,
      username: 'darthjee',
      email: 'darthjee@example.com',
      passwordDigest: await bcrypt.hash('current-password', 4),
      isAdmin: false,
    } as User;

    userRepository = repoMock<User>();
    userRepository.findOneBy.mockResolvedValue(user);
    authService = { assertAvailableForUpdate: jest.fn().mockResolvedValue(undefined) };
    accountEditAbuseGuardService = {
      isLockedOut: jest.fn().mockResolvedValue(false),
      registerFailure: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
    };

    const userUpdateService = new UserUpdateService(userRepository as never);

    service = new AccountService(
      userRepository as never,
      authService as unknown as AuthService,
      userUpdateService,
      accountEditAbuseGuardService as unknown as AccountEditAbuseGuardService,
    );
  });

  describe('updateAccount', () => {
    describe('when only the username is provided', () => {
      it('updates the username and returns the resulting { username, email }', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'new-username',
        });

        expect(result).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
      });

      it('resets the abuse-guard lockout counter on success', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'new-username',
        });

        expect(accountEditAbuseGuardService.reset).toHaveBeenCalledWith(1);
      });
    });

    describe('when only the email is provided', () => {
      it('updates the email and returns the resulting { username, email }', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          email: 'new-email@example.com',
        });

        expect(result).toEqual({ username: 'darthjee', email: 'new-email@example.com' });
      });
    });

    describe('when only the newPassword is provided', () => {
      it('hashes and stores the new password digest', async () => {
        const originalDigest = user.passwordDigest;

        await service.updateAccount(1, {
          currentPassword: 'current-password',
          newPassword: 'brand-new-password',
        });

        const savedUser = userRepository.save.mock.calls[0][0];

        expect(savedUser.passwordDigest).not.toBe(originalDigest);
        await expect(bcrypt.compare('brand-new-password', savedUser.passwordDigest)).resolves.toBe(true);
      });

      it('returns the unchanged { username, email }', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          newPassword: 'brand-new-password',
        });

        expect(result).toEqual({ username: 'darthjee', email: 'darthjee@example.com' });
      });
    });

    describe('when username, email, and newPassword are all provided', () => {
      it('applies all three updates', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'new-username',
          email: 'new-email@example.com',
          newPassword: 'brand-new-password',
        });

        expect(result).toEqual({ username: 'new-username', email: 'new-email@example.com' });

        const savedUser = userRepository.save.mock.calls[0][0];
        await expect(bcrypt.compare('brand-new-password', savedUser.passwordDigest)).resolves.toBe(true);
      });
    });

    describe('when the current password is wrong', () => {
      it('rejects with BadRequestException and does not save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'wrong-password', username: 'new-username' }),
        ).rejects.toThrow(new BadRequestException('Invalid current password'));

        expect(userRepository.save).not.toHaveBeenCalled();
      });

      it('registers a failure with the abuse guard', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'wrong-password', username: 'new-username' }),
        ).rejects.toThrow(BadRequestException);

        expect(accountEditAbuseGuardService.registerFailure).toHaveBeenCalledWith(1);
      });
    });

    describe('when the new username is already taken by another user', () => {
      beforeEach(() => {
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Username already in use'),
        );
      });

      it('rejects with ConflictException and does not save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'taken-username' }),
        ).rejects.toThrow(new ConflictException('Username already in use'));

        expect(userRepository.save).not.toHaveBeenCalled();
      });

      it('registers a failure with the abuse guard', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'taken-username' }),
        ).rejects.toThrow(ConflictException);

        expect(accountEditAbuseGuardService.registerFailure).toHaveBeenCalledWith(1);
      });
    });

    describe('when the new email is already taken by another user', () => {
      beforeEach(() => {
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Email already in use'),
        );
      });

      it('rejects with ConflictException and does not save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', email: 'taken@example.com' }),
        ).rejects.toThrow(new ConflictException('Email already in use'));

        expect(userRepository.save).not.toHaveBeenCalled();
      });

      it('registers a failure with the abuse guard', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', email: 'taken@example.com' }),
        ).rejects.toThrow(ConflictException);

        expect(accountEditAbuseGuardService.registerFailure).toHaveBeenCalledWith(1);
      });
    });

    describe('when the caller is locked out', () => {
      beforeEach(() => {
        accountEditAbuseGuardService.isLockedOut.mockResolvedValue(true);
      });

      it('rejects with a 423 LockedException without loading the user', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'new-username' }),
        ).rejects.toThrow(new LockedException('Account temporarily locked due to too many failed attempts'));

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });

      it('rejects with status 423', async () => {
        try {
          await service.updateAccount(1, { currentPassword: 'current-password', username: 'new-username' });
          throw new Error('expected updateAccount to reject');
        } catch (error) {
          expect((error as HttpException).getStatus()).toBe(423);
        }
      });

      it('does not register another failure or save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'new-username' }),
        ).rejects.toThrow(HttpException);

        expect(accountEditAbuseGuardService.registerFailure).not.toHaveBeenCalled();
        expect(userRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('when no username, email, or newPassword is provided', () => {
      it('rejects with BadRequestException without loading the user', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password' }),
        ).rejects.toThrow(BadRequestException);

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });
    });

    describe('when the username/email are set to the value the user already has', () => {
      it('does not treat it as a duplicate (self-exclusion)', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'darthjee',
          email: 'darthjee@example.com',
        });

        expect(authService.assertAvailableForUpdate).toHaveBeenCalledWith(1, undefined, undefined);
        expect(userRepository.save).toHaveBeenCalled();
      });
    });

    describe('when the session no longer matches a real user', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(
          service.updateAccount(999, { currentPassword: 'current-password', username: 'new-username' }),
        ).rejects.toThrow(UnauthorizedException);
      });
    });
  });
});
