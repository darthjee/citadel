import { NotFoundException } from '@nestjs/common';
import {
  buildFakeAuthorizationRequest,
  queryBuilderMock,
  useAuthorizationRequestServiceContext,
} from './authorization-request.service.test-support.js';
import { User } from '../entities/user.entity.js';

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
      const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

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
