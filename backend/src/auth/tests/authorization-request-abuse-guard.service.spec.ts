import { ConfigService } from '@nestjs/config';
import { AuthorizationRequestAbuseGuardService } from '../authorization-request-abuse-guard.service.js';
import { expectBothCreateCountsComputed } from './authorization-request.service.test-support.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';

type RepoMock = {
  count: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
};

function repoMock(): RepoMock {
  return {
    count: jest.fn(async () => 0),
    findOne: jest.fn(async () => null),
    update: jest.fn(),
  };
}

describe('AuthorizationRequestAbuseGuardService', () => {
  let authorizationRequestRepository: RepoMock;
  let configService: { get: jest.Mock };
  let guard: AuthorizationRequestAbuseGuardService;

  beforeEach(() => {
    authorizationRequestRepository = repoMock();
    configService = { get: jest.fn().mockReturnValue(undefined) };

    guard = new AuthorizationRequestAbuseGuardService(
      authorizationRequestRepository as never,
      configService as unknown as ConfigService,
    );
  });

  describe('isOverCreateLimit', () => {
    it('returns false when both counts are below the default limit (5)', async () => {
      authorizationRequestRepository.count.mockResolvedValue(4);

      await expect(guard.isOverCreateLimit('203.0.113.1', 'darthjee')).resolves.toBe(false);
    });

    it('returns true when the per-IP count is at the limit', async () => {
      authorizationRequestRepository.count.mockImplementation(async ({ where }: { where: { requestIp?: string } }) =>
        (where.requestIp ? 5 : 0),
      );

      await expect(guard.isOverCreateLimit('203.0.113.1', 'darthjee')).resolves.toBe(true);
    });

    it('returns true when the per-username count is at the limit', async () => {
      authorizationRequestRepository.count.mockImplementation(async ({ where }: { where: { username?: string } }) =>
        (where.username ? 5 : 0),
      );

      await expect(guard.isOverCreateLimit('203.0.113.1', 'darthjee')).resolves.toBe(true);
    });

    it('always computes both counts, never short-circuiting on the first', async () => {
      await guard.isOverCreateLimit('203.0.113.1', 'darthjee');

      expectBothCreateCountsComputed(authorizationRequestRepository, '203.0.113.1', 'darthjee');
    });

    it('respects a configured CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT override', async () => {
      configService.get.mockImplementation((key: string) =>
        (key === 'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT' ? 2 : undefined),
      );
      authorizationRequestRepository.count.mockResolvedValue(2);

      await expect(guard.isOverCreateLimit('203.0.113.1', 'darthjee')).resolves.toBe(true);
    });
  });

  describe('enforceOpenCapFor', () => {
    it('does not evict anything when the open count is below the default cap (5)', async () => {
      authorizationRequestRepository.count.mockResolvedValue(4);

      await guard.enforceOpenCapFor(1);

      expect(authorizationRequestRepository.findOne).not.toHaveBeenCalled();
      expect(authorizationRequestRepository.update).not.toHaveBeenCalled();
    });

    it("evicts the oldest open row by flipping it to 'expired' when at/over the cap", async () => {
      authorizationRequestRepository.count.mockResolvedValue(5);
      authorizationRequestRepository.findOne.mockResolvedValue({ id: 42, userId: 1, status: 'open' });

      await guard.enforceOpenCapFor(1);

      expect(authorizationRequestRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, status: 'open' }, order: { createdAt: 'ASC' } }),
      );
      expect(authorizationRequestRepository.update).toHaveBeenCalledWith(42, {
        status: 'expired',
        resolvedAt: expect.any(Date),
      });
    });

    it('does nothing further when at/over the cap but no oldest row is found', async () => {
      authorizationRequestRepository.count.mockResolvedValue(5);
      authorizationRequestRepository.findOne.mockResolvedValue(null);

      await guard.enforceOpenCapFor(1);

      expect(authorizationRequestRepository.update).not.toHaveBeenCalled();
    });

    it('respects a configured CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER override', async () => {
      configService.get.mockImplementation((key: string) =>
        (key === 'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER' ? 1 : undefined),
      );
      authorizationRequestRepository.count.mockResolvedValue(1);
      authorizationRequestRepository.findOne.mockResolvedValue({ id: 7, userId: 1, status: 'open' });

      await guard.enforceOpenCapFor(1);

      expect(authorizationRequestRepository.update).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'expired' }));
    });
  });

  describe('isLockedOut', () => {
    const baseRow = { authorizeFailedAttempts: 0 } as AuthorizationRequest;

    it('returns false when authorizeLockedUntil is null', () => {
      expect(guard.isLockedOut({ ...baseRow, authorizeLockedUntil: null })).toBe(false);
    });

    it('returns true when authorizeLockedUntil is in the future', () => {
      expect(guard.isLockedOut({ ...baseRow, authorizeLockedUntil: new Date(Date.now() + 60000) })).toBe(true);
    });

    it('returns false when authorizeLockedUntil is in the past', () => {
      expect(guard.isLockedOut({ ...baseRow, authorizeLockedUntil: new Date(Date.now() - 60000) })).toBe(false);
    });
  });

  describe('registerAuthorizeFailure', () => {
    function row(authorizeFailedAttempts: number): AuthorizationRequest {
      return { id: 10, authorizeFailedAttempts, authorizeLockedUntil: null } as AuthorizationRequest;
    }

    it('increments authorizeFailedAttempts without locking, below the default threshold (5)', async () => {
      await guard.registerAuthorizeFailure(row(0));

      expect(authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
        authorizeFailedAttempts: 1,
        authorizeLockedUntil: null,
      });
    });

    it('locks the row once the default threshold (5) is reached', async () => {
      await guard.registerAuthorizeFailure(row(4));

      expect(authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
        authorizeFailedAttempts: 5,
        authorizeLockedUntil: expect.any(Date),
      });
    });

    it('respects a configured CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS override', async () => {
      configService.get.mockImplementation((key: string) =>
        (key === 'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS' ? 2 : undefined),
      );

      await guard.registerAuthorizeFailure(row(1));

      expect(authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
        authorizeFailedAttempts: 2,
        authorizeLockedUntil: expect.any(Date),
      });
    });

    it('sets authorizeLockedUntil roughly configured-lock-ms in the future when it trips', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS') return 1;
        if (key === 'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS') return 60000;
        return undefined;
      });
      const before = Date.now();

      await guard.registerAuthorizeFailure(row(0));

      const lockedUntil = authorizationRequestRepository.update.mock.calls[0][1].authorizeLockedUntil as Date;
      expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(before + 60000);
      expect(lockedUntil.getTime()).toBeLessThan(before + 60000 + 5000);
    });
  });
});
