import {
  expectBothCreateCountsComputed,
  sha256,
  useAuthorizationRequestServiceContext,
} from './authorization-request.service.test-support.js';
import { User } from '../entities/user.entity.js';

describe('AuthorizationRequestService', () => {
  const ctx = useAuthorizationRequestServiceContext();

  describe('create', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the username matches an account', () => {
      beforeEach(() => {
        ctx.userRepository.findOneBy.mockResolvedValue(user);
      });

      it('persists an open row bound to that user', async () => {
        await ctx.service.create('darthjee', '203.0.113.1', 'curl/8.0');

        expect(ctx.authorizationRequestRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'darthjee',
            userId: 1,
            status: 'open',
            requestIp: '203.0.113.1',
            requestUserAgent: 'curl/8.0',
          }),
        );
      });

      it('only persists the SHA-256 hash of the poll token', async () => {
        const result = await ctx.service.create('darthjee', '203.0.113.1', 'curl/8.0');

        const savedHash = ctx.authorizationRequestRepository.save.mock.calls[0][0].pollTokenHash;

        expect(savedHash).toBe(sha256(result.pollToken));
        expect(savedHash).not.toBe(result.pollToken);
      });

      it('emits authorization-request.created', async () => {
        const result = await ctx.service.create('darthjee', '203.0.113.1', 'curl/8.0');

        expect(ctx.eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.created',
          expect.objectContaining({ uuid: result.uuid, username: 'darthjee', userId: 1 }),
        );
      });
    });

    describe('when the username does not match any account', () => {
      beforeEach(() => {
        ctx.userRepository.findOneBy.mockResolvedValue(null);
      });

      it('persists a row with userId: null', async () => {
        await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

        expect(ctx.authorizationRequestRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'nobody', userId: null, status: 'open' }),
        );
      });

      it('returns the same shape as a matching username', async () => {
        const result = await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

        expect(result).toEqual({
          uuid: expect.any(String),
          pollToken: expect.any(String),
          expiresAt: expect.any(Date),
        });
      });

      it('emits authorization-request.created with userId: null', async () => {
        await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

        expect(ctx.eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.created',
          expect.objectContaining({ username: 'nobody', userId: null }),
        );
      });
    });

    it('derives expiresAt from the default TTL when unset', async () => {
      ctx.userRepository.findOneBy.mockResolvedValue(null);
      const before = Date.now();

      const result = await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600000);
      expect(result.expiresAt.getTime()).toBeLessThan(before + 3600000 + 5000);
    });

    it('coerces a string-valued env override into a numeric offset', async () => {
      ctx.userRepository.findOneBy.mockResolvedValue(null);
      ctx.configService.get.mockReturnValue('60000');
      const before = Date.now();

      const result = await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60000);
      expect(result.expiresAt.getTime()).toBeLessThan(before + 60000 + 5000);
    });

    describe('rate limiting', () => {
      function mockConfig(overrides: Record<string, unknown>): void {
        ctx.configService.get.mockImplementation((key: string) => overrides[key]);
      }

      function mockCountAtLimit(field: 'requestIp' | 'username'): void {
        mockConfig({ CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT: 5 });
        ctx.authorizationRequestRepository.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
          (where[field] ? 5 : 0),
        );
      }

      describe.each([
        { description: 'per-IP', field: 'requestIp' as const },
        { description: 'per-username', field: 'username' as const },
      ])('when the $description count is at the configured limit', ({ field }) => {
        beforeEach(() => {
          mockCountAtLimit(field);
        });

        it('does not persist a row', async () => {
          ctx.userRepository.findOneBy.mockResolvedValue(null);

          await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(ctx.authorizationRequestRepository.save).not.toHaveBeenCalled();
        });
      });

      describe('when the per-IP count is at the configured limit', () => {
        beforeEach(() => {
          mockCountAtLimit('requestIp');
        });

        it('does not emit authorization-request.created', async () => {
          ctx.userRepository.findOneBy.mockResolvedValue(null);

          await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(ctx.eventEmitter.emit).not.toHaveBeenCalled();
        });

        it('still returns the same { uuid, pollToken, expiresAt } shape, identically for a known username', async () => {
          const user = { id: 1, username: 'darthjee' } as User;
          ctx.userRepository.findOneBy.mockResolvedValue(user);

          const result = await ctx.service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(result).toEqual({
            uuid: expect.any(String),
            pollToken: expect.any(String),
            expiresAt: expect.any(Date),
          });
          expect(ctx.authorizationRequestRepository.save).not.toHaveBeenCalled();
        });
      });

      describe('when neither count is at the limit', () => {
        beforeEach(() => {
          mockConfig({ CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT: 5 });
          ctx.authorizationRequestRepository.count.mockResolvedValue(4);
        });

        it('persists the row as usual', async () => {
          ctx.userRepository.findOneBy.mockResolvedValue(null);

          await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(ctx.authorizationRequestRepository.save).toHaveBeenCalled();
        });
      });

      it('always computes both the IP and username counts (never short-circuits)', async () => {
        ctx.userRepository.findOneBy.mockResolvedValue(null);

        await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

        expectBothCreateCountsComputed(ctx.authorizationRequestRepository, '203.0.113.1', 'nobody');
      });
    });

    describe('concurrent-open cap', () => {
      const user = { id: 1, username: 'darthjee' } as User;

      beforeEach(() => {
        ctx.userRepository.findOneBy.mockResolvedValue(user);
        ctx.configService.get.mockImplementation((key: string) =>
          key === 'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER' ? 2 : undefined,
        );
      });

      describe('when the resolved user is at/over the cap', () => {
        const oldestOpenRow = { id: 5, userId: 1, status: 'open' };

        beforeEach(() => {
          ctx.authorizationRequestRepository.count.mockResolvedValue(2);
          ctx.authorizationRequestRepository.findOne.mockResolvedValue(oldestOpenRow);
        });

        it("evicts the oldest open row by flipping it to 'expired'", async () => {
          await ctx.service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(5, {
            status: 'expired',
            resolvedAt: expect.any(Date),
          });
        });

        it('never rejects — the new row is still persisted', async () => {
          await ctx.service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(ctx.authorizationRequestRepository.save).toHaveBeenCalled();
        });
      });

      describe('when the resolved user is below the cap', () => {
        beforeEach(() => {
          ctx.authorizationRequestRepository.count.mockResolvedValue(1);
        });

        it('does not evict anything', async () => {
          await ctx.service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(ctx.authorizationRequestRepository.findOne).not.toHaveBeenCalled();
        });
      });

      describe('when the username does not resolve to a user', () => {
        beforeEach(() => {
          ctx.userRepository.findOneBy.mockResolvedValue(null);
        });

        it('never checks or evicts (cap only applies to resolved users)', async () => {
          await ctx.service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(ctx.authorizationRequestRepository.findOne).not.toHaveBeenCalled();
        });
      });
    });
  });
});
