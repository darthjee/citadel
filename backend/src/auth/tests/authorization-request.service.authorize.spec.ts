import { BadRequestException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  buildFakeAuthorizationRequest,
  useAuthorizationRequestServiceContext,
} from './authorization-request.service.test-support.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { User } from '../entities/user.entity.js';

describe('AuthorizationRequestService', () => {
  const ctx = useAuthorizationRequestServiceContext();

  describe('authorize', () => {
    const approverPasswordDigest = bcrypt.hashSync('approver-password', 10);
    const approver = { id: 1, username: 'darthjee', passwordDigest: approverPasswordDigest } as User;
    const openRow = buildFakeAuthorizationRequest();

    beforeEach(() => {
      ctx.userRepository.findOneBy.mockResolvedValue(approver);
    });

    describe('when the row is open, owned by the approver, not expired, and the password is correct', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow });
      });

      it('marks the row approved with approvedByUserId and resolvedAt set, resetting the cool-off counters', async () => {
        await ctx.service.authorize('uuid-1', 1, 'approver-password');

        expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          status: 'approved',
          approvedByUserId: 1,
          resolvedAt: expect.any(Date),
          authorizeFailedAttempts: 0,
          authorizeLockedUntil: null,
        });
      });

      it('emits authorization-request.approved', async () => {
        await ctx.service.authorize('uuid-1', 1, 'approver-password');

        expect(ctx.eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.approved',
          expect.objectContaining({ uuid: 'uuid-1', approvedByUserId: 1 }),
        );
      });
    });

    describe('when the request cannot be authorized', () => {
      const rejectionCases: { description: string; uuid: string; password: string; row: () => AuthorizationRequest | null }[] = [
        { description: 'the row is missing', uuid: 'unknown-uuid', password: 'approver-password', row: () => null },
        {
          description: 'the row belongs to another user',
          uuid: 'uuid-1',
          password: 'approver-password',
          row: () => ({ ...openRow, userId: 2 }),
        },
        {
          description: 'the row is not open',
          uuid: 'uuid-1',
          password: 'approver-password',
          row: () => ({ ...openRow, status: 'denied' }),
        },
        {
          description: 'the row is past its expiresAt',
          uuid: 'uuid-1',
          password: 'approver-password',
          row: () => ({ ...openRow, expiresAt: new Date(Date.now() - 1000) }),
        },
        { description: 'the password is wrong', uuid: 'uuid-1', password: 'wrong-password', row: () => ({ ...openRow }) },
      ];

      it.each(rejectionCases)('rejects with the uniform BadRequestException when $description', async ({ uuid, password, row }) => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue(row());

        await expect(ctx.service.authorize(uuid, 1, password)).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });

      it.each(rejectionCases.slice(0, 2))('does not emit an event when $description', async ({ uuid, password, row }) => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue(row());

        await expect(ctx.service.authorize(uuid, 1, password)).rejects.toThrow();

        expect(ctx.eventEmitter.emit).not.toHaveBeenCalled();
      });
    });

    describe('when the password is wrong', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow });
      });

      it('increments authorizeFailedAttempts without locking the row (below threshold)', async () => {
        await expect(ctx.service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

        expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          authorizeFailedAttempts: 1,
          authorizeLockedUntil: null,
        });
      });
    });

    describe('cool-off lockout', () => {
      it('locks the row once authorizeFailedAttempts reaches the configured max-attempts threshold', async () => {
        ctx.configService.get.mockImplementation((key: string) =>
          key === 'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS' ? 2 : undefined,
        );
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, authorizeFailedAttempts: 1 });

        await expect(ctx.service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

        expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          authorizeFailedAttempts: 2,
          authorizeLockedUntil: expect.any(Date),
        });
      });

      describe('when the row is already locked', () => {
        beforeEach(() => {
          ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({
            ...openRow,
            authorizeFailedAttempts: 5,
            authorizeLockedUntil: new Date(Date.now() + 60000),
          });
        });

        it('rejects with the same uniform BadRequestException as an ordinary wrong-password rejection', async () => {
          await expect(ctx.service.authorize('uuid-1', 1, 'my-password')).rejects.toThrow(
            new BadRequestException('Unable to authorize this request'),
          );
        });

        it('still runs the password compare (equivalent cost to a normal attempt), even with the correct password', async () => {
          const compareSpy = jest.spyOn(bcrypt, 'compare');

          await expect(ctx.service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow();

          expect(compareSpy).toHaveBeenCalledWith('approver-password', approverPasswordDigest);
          compareSpy.mockRestore();
        });

        it('does not increment authorizeFailedAttempts further while already locked', async () => {
          await expect(ctx.service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

          expect(ctx.authorizationRequestRepository.update).not.toHaveBeenCalled();
        });
      });
    });
  });
});
