import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ILike } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { MailService } from '../../mail/mail.service.js';
import { AdminService, CANNOT_DENY_SELF_MESSAGE, USER_NOT_PENDING_MESSAGE } from '../admin.service.js';
import { AuthService } from '../auth.service.js';
import { RevokedReason } from '../entities/refresh-token.entity.js';
import { User, UserStatus } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';
import { TokenService } from '../token.service.js';
import { UserUpdateService } from '../user-update.service.js';

type UserRepoMock = {
  find: jest.Mock;
  findOneBy: jest.Mock;
  update: jest.Mock;
};

function userRepoMock(): UserRepoMock {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
}

describe('AdminService', () => {
  let userRepository: UserRepoMock;
  let authService: { assertAvailableForUpdate: jest.Mock };
  let passwordResetService: { issueToken: jest.Mock };
  let mailService: { sendEmailTemplate: jest.Mock };
  let userUpdateService: { applyUserUpdate: jest.Mock };
  let tokenService: { revokeUserTokens: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    userRepository = userRepoMock();
    authService = { assertAvailableForUpdate: jest.fn().mockResolvedValue(undefined) };
    passwordResetService = { issueToken: jest.fn() };
    mailService = { sendEmailTemplate: jest.fn() };
    userUpdateService = { applyUserUpdate: jest.fn().mockResolvedValue(undefined) };
    tokenService = { revokeUserTokens: jest.fn().mockResolvedValue(undefined) };

    service = new AdminService(
      userRepository as never,
      authService as unknown as AuthService,
      passwordResetService as unknown as PasswordResetService,
      mailService as unknown as MailService,
      userUpdateService as unknown as UserUpdateService,
      tokenService as unknown as TokenService,
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

    describe.each(Object.values(UserStatus))('when only status %s is given', (status) => {
      it('filters by that status alone', async () => {
        const users = [{ id: 1, status } as User];
        userRepository.find.mockResolvedValue(users);

        await expect(service.searchUsers(undefined, status)).resolves.toBe(users);
        expect(userRepository.find).toHaveBeenCalledWith({ where: { status } });
      });
    });

    describe('when both a query and a status are given', () => {
      it('ANDs the status into both ILike branches', async () => {
        userRepository.find.mockResolvedValue([]);

        await service.searchUsers('darth', UserStatus.PENDING);

        expect(userRepository.find).toHaveBeenCalledWith({
          where: [
            { username: ILike('%darth%'), status: UserStatus.PENDING },
            { email: ILike('%darth%'), status: UserStatus.PENDING },
          ],
        });
      });
    });
  });

  describe('approveUser', () => {
    const pending = { id: 3, username: 'padawan', status: UserStatus.PENDING } as User;
    const approved = { ...pending, status: UserStatus.APPROVED } as User;

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException without updating anything', async () => {
        await expect(service.approveUser(404)).rejects.toThrow(new NotFoundException('User not found'));
        expect(userRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('when the user is pending', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValueOnce(pending).mockResolvedValueOnce(approved);
        userRepository.update.mockResolvedValue({ affected: 1 });
      });

      it('approves through a conditional update on the pending status', async () => {
        await service.approveUser(3);

        expect(userRepository.update).toHaveBeenCalledWith(
          { id: 3, status: UserStatus.PENDING },
          { status: UserStatus.APPROVED },
        );
      });

      it('returns the re-read row', async () => {
        await expect(service.approveUser(3)).resolves.toBe(approved);
        expect(userRepository.findOneBy).toHaveBeenCalledTimes(2);
      });
    });

    describe.each([
      ['approved', UserStatus.APPROVED],
      ['denied', UserStatus.DENIED],
      ['pending but concurrently denied', UserStatus.PENDING],
    ])('when the user is %s (the conditional update affects no row)', (_label, status) => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue({ ...pending, status });
        userRepository.update.mockResolvedValue({ affected: 0 });
      });

      it('rejects with 422 USER_NOT_PENDING', async () => {
        const error = await service.approveUser(3).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(UnprocessableEntityException);
        expect((error as UnprocessableEntityException).getResponse()).toEqual({
          code: ErrorCodes.USER_NOT_PENDING,
          message: USER_NOT_PENDING_MESSAGE,
        });
      });
    });
  });

  describe('denyUser', () => {
    const callerId = 1;
    const target = { id: 3, username: 'padawan', isAdmin: false, status: UserStatus.APPROVED } as User;

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException without writing anything', async () => {
        await expect(service.denyUser(404, callerId)).rejects.toThrow(new NotFoundException('User not found'));
        expect(userRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the user is the caller', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue({ ...target, id: callerId, isAdmin: true });
      });

      it('rejects with 422 CANNOT_DENY_SELF without writing anything', async () => {
        const error = await service.denyUser(callerId, callerId).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(UnprocessableEntityException);
        expect((error as UnprocessableEntityException).getResponse()).toEqual({
          code: ErrorCodes.CANNOT_DENY_SELF,
          message: CANNOT_DENY_SELF_MESSAGE,
        });
        expect(userRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe.each([
      ['pending', { status: UserStatus.PENDING }],
      ['approved', { status: UserStatus.APPROVED }],
      ['already denied', { status: UserStatus.DENIED }],
      ['another admin', { isAdmin: true }],
    ])('when the user is %s', (_label, attrs) => {
      const denied = { ...target, ...attrs, status: UserStatus.DENIED } as User;

      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValueOnce({ ...target, ...attrs }).mockResolvedValueOnce(denied);
        userRepository.update.mockResolvedValue({ affected: 1 });
      });

      it('sets the status to denied, then revokes every active token with admin_denied', async () => {
        await service.denyUser(3, callerId);

        expect(userRepository.update).toHaveBeenCalledWith({ id: 3 }, { status: UserStatus.DENIED });
        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(3, RevokedReason.ADMIN_DENIED);
        expect(userRepository.update.mock.invocationCallOrder[0]).toBeLessThan(
          tokenService.revokeUserTokens.mock.invocationCallOrder[0],
        );
      });

      it('returns the re-read row', async () => {
        await expect(service.denyUser(3, callerId)).resolves.toBe(denied);
      });
    });

    describe('when the bulk revoke fails', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(target);
        userRepository.update.mockResolvedValue({ affected: 1 });
        tokenService.revokeUserTokens.mockRejectedValue(new Error('revoke failed'));
      });

      it('rejects after the status update has been written', async () => {
        await expect(service.denyUser(3, callerId)).rejects.toThrow('revoke failed');
        expect(userRepository.update).toHaveBeenCalledWith({ id: 3 }, { status: UserStatus.DENIED });
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

    describe('when a deny commits between the user load and the persist', () => {
      let storedRow: User;

      beforeEach(() => {
        storedRow = { id: 1, username: 'darthjee', email: 'darthjee@example.com', status: UserStatus.APPROVED } as User;
        // Every read returns a fresh copy of the row (as a real DB read would); right after the
        // edit's first load, a concurrent deny commits on the stored row.
        userRepository.findOneBy.mockImplementationOnce(async () => {
          const loaded = { ...storedRow };
          storedRow.status = UserStatus.DENIED;

          return loaded;
        });
        userRepository.findOneBy.mockImplementation(async () => ({ ...storedRow }));
        userRepository.update.mockImplementation(async (_id, columns) => {
          Object.assign(storedRow, columns);

          return { affected: 1 };
        });

        service = new AdminService(
          userRepository as never,
          authService as unknown as AuthService,
          passwordResetService as unknown as PasswordResetService,
          mailService as unknown as MailService,
          new UserUpdateService(userRepository as never),
          tokenService as unknown as TokenService,
        );
      });

      it('keeps the user denied while applying the admin edit', async () => {
        const result = await service.editUser(1, { username: 'vader' });

        expect(storedRow).toEqual(expect.objectContaining({ username: 'vader', status: UserStatus.DENIED }));
        expect(result).toEqual(expect.objectContaining({ username: 'vader', status: UserStatus.DENIED }));
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
