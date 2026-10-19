import { NotFoundException } from '@nestjs/common';
import {
  buildFakeAuthorizationRequest,
  queryBuilderMock,
  useAuthorizationRequestServiceContext,
} from './authorization-request.service.test-support.js';
import { User, UserStatus } from '../entities/user.entity.js';

describe('AuthorizationRequestService', () => {
  const ctx = useAuthorizationRequestServiceContext();

  describe('poll', () => {
    const baseRow = buildFakeAuthorizationRequest();

    describe('when the uuid is unknown', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException', async () => {
        await expect(ctx.service.poll('unknown-uuid', 'poll-token')).rejects.toThrow(NotFoundException);
      });
    });

    describe('when the poll token is wrong', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with the same NotFoundException', async () => {
        await expect(ctx.service.poll('uuid-1', 'wrong-token')).rejects.toThrow(NotFoundException);
      });
    });

    describe('when the request is open and not expired', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'open' });
      });

      it('returns { status: "open" }', async () => {
        await expect(ctx.service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'open' });
      });
    });

    describe('when the request is open and past its expiresAt', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({
          ...baseRow,
          status: 'open',
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('flips the row to expired with resolvedAt set', async () => {
        await ctx.service.poll('uuid-1', 'poll-token');

        expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          status: 'expired',
          resolvedAt: expect.any(Date),
        });
      });

      it('returns { status: "expired" }', async () => {
        await expect(ctx.service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'expired' });
      });
    });

    describe('when the request was denied', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'denied' });
      });

      it('returns { status: "denied" } without touching the claim UPDATE', async () => {
        await expect(ctx.service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'denied' });
        expect(ctx.authorizationRequestRepository.createQueryBuilder).not.toHaveBeenCalled();
      });
    });

    describe('when the request is already logged', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'logged' });
      });

      it('returns { status: "logged" } with no credentials', async () => {
        await expect(ctx.service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'logged' });
      });
    });

    describe('when the request is approved', () => {
      const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com', status: UserStatus.APPROVED } as User;

      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'approved' });
        ctx.userRepository.findOneBy.mockResolvedValue(user);
      });

      describe('and this poll wins the atomic claim (affected: 1)', () => {
        let builder: ReturnType<typeof queryBuilderMock>;

        beforeEach(() => {
          builder = queryBuilderMock({ affected: 1 });
          ctx.authorizationRequestRepository.createQueryBuilder.mockReturnValue(builder);
        });

        it('mints a session for the row\'s user', async () => {
          await ctx.service.poll('uuid-1', 'poll-token');

          expect(ctx.tokenService.issueTokens).toHaveBeenCalledWith(user);
        });

        it('never writes resolvedAt as part of the claim UPDATE', async () => {
          await ctx.service.poll('uuid-1', 'poll-token');

          expect(builder.set).toHaveBeenCalledWith(
            expect.not.objectContaining({ resolvedAt: expect.anything() }),
          );
        });

        it('emits authorization-request.logged', async () => {
          await ctx.service.poll('uuid-1', 'poll-token');

          expect(ctx.eventEmitter.emit).toHaveBeenCalledWith(
            'authorization-request.logged',
            expect.objectContaining({ uuid: 'uuid-1', userId: 1 }),
          );
        });

        it('returns { status: "approved" } with the freshly issued session', async () => {
          const result = await ctx.service.poll('uuid-1', 'poll-token');

          expect(result).toEqual({
            status: 'approved',
            authResult: { user, accessToken: 'jwt', refreshToken: 'rt' },
          });
        });
      });

      describe.each([UserStatus.PENDING, UserStatus.DENIED])('and this poll wins, but the requester is %s', (status) => {
        let builders: ReturnType<typeof queryBuilderMock>[];

        beforeEach(() => {
          builders = [queryBuilderMock({ affected: 1 }), queryBuilderMock({ affected: 1 })];
          ctx.authorizationRequestRepository.createQueryBuilder
            .mockReturnValueOnce(builders[0])
            .mockReturnValueOnce(builders[1]);
          ctx.userRepository.findOneBy.mockResolvedValue({ ...user, status });
        });

        it('returns { status: "denied" } with no credentials', async () => {
          await expect(ctx.service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'denied' });
        });

        it('does not mint a session nor emit authorization-request.logged', async () => {
          await ctx.service.poll('uuid-1', 'poll-token');

          expect(ctx.tokenService.issueTokens).not.toHaveBeenCalled();
          expect(ctx.eventEmitter.emit).not.toHaveBeenCalled();
        });

        it('reloads the requester by the row userId', async () => {
          await ctx.service.poll('uuid-1', 'poll-token');

          expect(ctx.userRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
        });

        it('moves the request logged -> denied with a conditional UPDATE after the claim', async () => {
          await ctx.service.poll('uuid-1', 'poll-token');

          expect(builders[0].where).toHaveBeenCalledWith('uuid = :uuid AND status = :status', {
            uuid: 'uuid-1',
            status: 'approved',
          });
          expect(builders[1].set).toHaveBeenCalledWith({ status: 'denied', resolvedAt: expect.any(Function) });
          expect(builders[1].set.mock.calls[0][0].resolvedAt()).toBe('CURRENT_TIMESTAMP');
          expect(builders[1].where).toHaveBeenCalledWith('uuid = :uuid AND status = :status', {
            uuid: 'uuid-1',
            status: 'logged',
          });
        });
      });

      describe('and the requester no longer exists', () => {
        beforeEach(() => {
          ctx.userRepository.findOneBy.mockResolvedValue(null);
        });

        it('returns { status: "logged" } without minting a session', async () => {
          await expect(ctx.service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'logged' });
          expect(ctx.tokenService.issueTokens).not.toHaveBeenCalled();
        });
      });

      describe('and this poll loses the atomic claim (affected: 0)', () => {
        beforeEach(() => {
          ctx.authorizationRequestRepository.createQueryBuilder.mockReturnValue(queryBuilderMock({ affected: 0 }));
        });

        it('does not mint a session', async () => {
          await ctx.service.poll('uuid-1', 'poll-token');

          expect(ctx.tokenService.issueTokens).not.toHaveBeenCalled();
        });

        it('returns { status: "logged" } with no credentials', async () => {
          await expect(ctx.service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'logged' });
        });
      });
    });
  });
});
