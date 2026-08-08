import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ILike } from 'typeorm';
import { MailService } from '../../mail/mail.service.js';
import { AdminService } from '../admin.service.js';
import { AuthService } from '../auth.service.js';
import { User } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';
import { UserUpdateService } from '../user-update.service.js';

type UserRepoMock = {
  find: jest.Mock;
  findOneBy: jest.Mock;
};

function userRepoMock(): UserRepoMock {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
  };
}

describe('AdminService', () => {
  let userRepository: UserRepoMock;
  let authService: { assertAvailableForUpdate: jest.Mock };
  let passwordResetService: { issueToken: jest.Mock };
  let mailService: { sendEmailTemplate: jest.Mock };
  let userUpdateService: { applyUserUpdate: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    userRepository = userRepoMock();
    authService = { assertAvailableForUpdate: jest.fn().mockResolvedValue(undefined) };
    passwordResetService = { issueToken: jest.fn() };
    mailService = { sendEmailTemplate: jest.fn() };
    userUpdateService = { applyUserUpdate: jest.fn().mockResolvedValue(undefined) };

    service = new AdminService(
      userRepository as never,
      authService as unknown as AuthService,
      passwordResetService as unknown as PasswordResetService,
      mailService as unknown as MailService,
      userUpdateService as unknown as UserUpdateService,
    );
  });

  describe('searchUsers', () => {
    describe('when no query is given', () => {
      it('returns every user', async () => {
        const users = [{ id: 1 } as User, { id: 2 } as User];
        userRepository.find.mockResolvedValue(users);

        await expect(service.searchUsers()).resolves.toBe(users);
        expect(userRepository.find).toHaveBeenCalledWith();
      });
    });

    describe('when a query is given', () => {
      it('matches case-insensitively against username or email', async () => {
        const users = [{ id: 1, username: 'darthjee' } as User];
        userRepository.find.mockResolvedValue(users);

        const result = await service.searchUsers('darth');

        expect(result).toBe(users);
        expect(userRepository.find).toHaveBeenCalledWith({
          where: [{ username: ILike('%darth%') }, { email: ILike('%darth%') }],
        });
      });
    });
  });

  describe('generateRecoveryLink', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the user exists', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        passwordResetService.issueToken.mockResolvedValue({
          token: 'plaintext-token',
          resetUrl: 'http://localhost:3000/#/recover-password?token=plaintext-token',
        });
      });

      it('mints a token for that user and returns its resetUrl', async () => {
        await expect(service.generateRecoveryLink(1)).resolves.toEqual({
          resetUrl: 'http://localhost:3000/#/recover-password?token=plaintext-token',
        });
        expect(passwordResetService.issueToken).toHaveBeenCalledWith(user);
      });
    });

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException', async () => {
        await expect(service.generateRecoveryLink(404)).rejects.toThrow(NotFoundException);
        expect(passwordResetService.issueToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('sendRecoveryEmail', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException without minting a token', async () => {
        await expect(service.sendRecoveryEmail(404)).rejects.toThrow(NotFoundException);
        expect(passwordResetService.issueToken).not.toHaveBeenCalled();
      });
    });

    describe('when the user exists', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        passwordResetService.issueToken.mockResolvedValue({
          token: 'plaintext-token',
          resetUrl: 'http://localhost:3000/#/recover-password?token=plaintext-token',
        });
      });

      describe('and the mail transport accepts the message', () => {
        beforeEach(() => {
          mailService.sendEmailTemplate.mockResolvedValue({ status: 'sent', messageId: 'abc' });
        });

        it('resolves with sent: true', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: true });
        });

        it('sends to the user email with the recovery email content', async () => {
          await service.sendRecoveryEmail(1);

          expect(mailService.sendEmailTemplate).toHaveBeenCalledWith({
            to: 'darthjee@example.com',
            template: 'password-recovery',
            variables: {
              resetUrl: expect.stringContaining(
                'http://localhost:3000/#/recover-password?token=plaintext-token',
              ),
            },
          });
        });
      });

      describe('and email is disabled (skipped)', () => {
        beforeEach(() => {
          mailService.sendEmailTemplate.mockResolvedValue({ status: 'skipped' });
        });

        it('resolves with sent: false', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: false });
        });
      });

      describe('and the mail transport throws', () => {
        beforeEach(() => {
          mailService.sendEmailTemplate.mockRejectedValue(new Error('smtp exploded'));
        });

        it('resolves with sent: false rather than propagating the error', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: false });
        });
      });
    });
  });

  describe('editUser', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the user exists', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('applies a username change', async () => {
        const result = await service.editUser(1, { username: 'new-username' });

        expect(result).toBe(user);
        expect(userUpdateService.applyUserUpdate).toHaveBeenCalledWith(user, {
          username: 'new-username',
        });
      });

      it('applies an email change', async () => {
        await service.editUser(1, { email: 'new-email@example.com' });

        expect(userUpdateService.applyUserUpdate).toHaveBeenCalledWith(user, {
          email: 'new-email@example.com',
        });
      });

      it('applies a password change', async () => {
        await service.editUser(1, { newPassword: 'brand-new-password' });

        expect(userUpdateService.applyUserUpdate).toHaveBeenCalledWith(user, {
          newPassword: 'brand-new-password',
        });
      });

      it('checks availability excluding the target user itself', async () => {
        await service.editUser(1, { username: 'new-username', email: 'new-email@example.com' });

        expect(authService.assertAvailableForUpdate).toHaveBeenCalledWith(
          1,
          'new-username',
          'new-email@example.com',
        );
      });

      it('does not treat the value the user already has as a duplicate (self-exclusion)', async () => {
        await service.editUser(1, { username: 'darthjee', email: 'darthjee@example.com' });

        expect(authService.assertAvailableForUpdate).toHaveBeenCalledWith(1, undefined, undefined);
      });

      it('works identically when the target user is the calling admin', async () => {
        const result = await service.editUser(1, { username: 'new-username' });

        expect(result).toBe(user);
      });
    });

    describe('when the new username is already taken by another user', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Username already in use'),
        );
      });

      it('rejects with ConflictException without applying any changes', async () => {
        await expect(
          service.editUser(1, { username: 'taken-username' }),
        ).rejects.toThrow(new ConflictException('Username already in use'));

        expect(userUpdateService.applyUserUpdate).not.toHaveBeenCalled();
      });
    });

    describe('when the new email is already taken by another user', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Email already in use'),
        );
      });

      it('rejects with ConflictException without applying any changes', async () => {
        await expect(
          service.editUser(1, { email: 'taken@example.com' }),
        ).rejects.toThrow(new ConflictException('Email already in use'));

        expect(userUpdateService.applyUserUpdate).not.toHaveBeenCalled();
      });
    });

    describe('when no username, email, or newPassword is provided', () => {
      it('rejects with BadRequestException without loading the user', async () => {
        await expect(service.editUser(1, {})).rejects.toThrow(BadRequestException);

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });
    });

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException', async () => {
        await expect(service.editUser(404, { username: 'new-username' })).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });
});
