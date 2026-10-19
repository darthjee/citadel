import { createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsNull } from 'typeorm';
import { RefreshToken, RevokedReason } from '../entities/refresh-token.entity.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('TokenService', () => {
  let refreshTokenRepository: RepoMock<RefreshToken>;
  let jwtService: { sign: jest.Mock };
  let service: TokenService;

  beforeEach(() => {
    refreshTokenRepository = repoMock<RefreshToken>();
    jwtService = { sign: jest.fn().mockReturnValue('signed-access-token') };

    service = new TokenService(
      refreshTokenRepository as never,
      jwtService as unknown as JwtService,
    );
  });

  describe('issueTokens', () => {
    const user = {
      id: 7,
      username: 'darthjee',
      email: 'darthjee@example.com',
      isAdmin: false,
    } as User;

    it('resolves with the user and the freshly issued token pair', async () => {
      const result = await service.issueTokens(user);

      expect(result.user).toBe(user);
      expect(result.accessToken).toBe('signed-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('signs the access token with the user sub, sid, username and isAdmin claims', async () => {
      await service.issueTokens(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 7,
        sid: expect.stringMatching(UUID_PATTERN),
        username: 'darthjee',
        isAdmin: false,
      });
    });

    it('signs a sid equal to the saved row sessionUuid for a new session', async () => {
      await service.issueTokens(user);

      const { sessionUuid } = refreshTokenRepository.save.mock.calls[0][0];

      expect(jwtService.sign.mock.calls[0][0].sid).toBe(sessionUuid);
    });

    it('signs a sid equal to the continued session sessionUuid', async () => {
      const session = { sessionUuid: '11111111-2222-4333-8444-555555555555', startedAt: new Date('2026-01-01T00:00:00Z') };

      await service.issueTokens(user, session);

      const { sessionUuid } = refreshTokenRepository.save.mock.calls[0][0];

      expect(sessionUuid).toBe(session.sessionUuid);
      expect(jwtService.sign.mock.calls[0][0].sid).toBe(session.sessionUuid);
    });

    it('produces an access token that decodes to the saved row sessionUuid as sid', async () => {
      const realJwt = new JwtService({ secret: 'test-secret' });
      const realService = new TokenService(refreshTokenRepository as never, realJwt);

      const { accessToken } = await realService.issueTokens(user);

      const { sessionUuid } = refreshTokenRepository.save.mock.calls[0][0];

      expect(realJwt.verify(accessToken)).toEqual(expect.objectContaining({ sub: 7, sid: sessionUuid }));
    });

    it('signs the access token with isAdmin: true for an admin user', async () => {
      await service.issueTokens({ ...user, isAdmin: true } as User);

      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: true }));
    });

    it('persists the refresh token as its SHA-256 hash, never in plaintext', async () => {
      const result = await service.issueTokens(user);
      const saved = refreshTokenRepository.save.mock.calls[0][0];

      expect(saved).toEqual(
        expect.objectContaining({ userId: 7, revokedAt: null, tokenHash: expect.any(String) }),
      );
      expect(saved.tokenHash).not.toBe(result.refreshToken);
      expect(saved.tokenHash).toBe(service.hashToken(result.refreshToken));
    });

    it('gives the refresh token a 7-day TTL', async () => {
      const before = Date.now();

      await service.issueTokens(user);

      const { expiresAt } = refreshTokenRepository.save.mock.calls[0][0];
      const after = Date.now();

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + SEVEN_DAYS_MS);
    });

    it('persists the row unrevoked, with no revoked reason', async () => {
      await service.issueTokens(user);

      expect(refreshTokenRepository.save.mock.calls[0][0]).toEqual(
        expect.objectContaining({ revokedAt: null, revokedReason: null }),
      );
    });

    it('starts a new session without one: a UUID sessionUuid, startedAt about now', async () => {
      const before = Date.now();

      await service.issueTokens(user);

      const { sessionUuid, startedAt } = refreshTokenRepository.save.mock.calls[0][0];
      const after = Date.now();

      expect(sessionUuid).toMatch(UUID_PATTERN);
      expect(startedAt).toBeInstanceOf(Date);
      expect(startedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(startedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('starts two different sessions on two calls without a session', async () => {
      await service.issueTokens(user);
      await service.issueTokens(user);

      const [first, second] = refreshTokenRepository.save.mock.calls.map(([row]) => row.sessionUuid);

      expect(first).not.toBe(second);
    });

    it('copies sessionUuid and startedAt when given a session', async () => {
      const session = { sessionUuid: '11111111-2222-4333-8444-555555555555', startedAt: new Date('2026-01-01T00:00:00Z') };

      await service.issueTokens(user, session);

      expect(refreshTokenRepository.save.mock.calls[0][0]).toEqual(
        expect.objectContaining({ sessionUuid: session.sessionUuid, startedAt: session.startedAt }),
      );
    });

    it('saves the row through the given entity manager, not the injected repository', async () => {
      const managerRepository = repoMock<RefreshToken>();
      const manager = { getRepository: jest.fn().mockReturnValue(managerRepository) };

      await service.issueTokens(user, undefined, manager as never);

      expect(manager.getRepository).toHaveBeenCalledWith(RefreshToken);
      expect(managerRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 7 }));
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('depends on no session repository', () => {
      expect(TokenService.length).toBe(2);
    });
  });

  describe('rotateTokens', () => {
    const user = { id: 7, username: 'darthjee', isAdmin: false } as User;
    const presented = {
      id: 10,
      userId: 7,
      sessionUuid: '11111111-2222-4333-8444-555555555555',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      revokedAt: null,
    } as RefreshToken;
    let managerRepository: RepoMock<RefreshToken>;
    let transactionOutcome: Promise<unknown> | undefined;

    beforeEach(() => {
      managerRepository = repoMock<RefreshToken>();
      managerRepository.update.mockResolvedValue({ affected: 1 });
      const manager = { getRepository: jest.fn().mockReturnValue(managerRepository) };
      transactionOutcome = undefined;

      Object.assign(refreshTokenRepository, {
        manager: {
          transaction: jest.fn((callback: (m: unknown) => Promise<unknown>) => {
            transactionOutcome = callback(manager);
            return transactionOutcome;
          }),
        },
      });
    });

    it('inserts the replacement in the presented row session, through the transaction manager', async () => {
      const result = await service.rotateTokens(user, presented);

      expect(result.user).toBe(user);
      expect(managerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          sessionUuid: presented.sessionUuid,
          startedAt: presented.startedAt,
          revokedAt: null,
          revokedReason: null,
        }),
      );
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('inserts first, then revokes the presented row only if still unrevoked, with rotated', async () => {
      await service.rotateTokens(user, presented);

      expect(managerRepository.update).toHaveBeenCalledWith(
        { id: 10, revokedAt: IsNull() },
        { revokedAt: expect.any(Date), revokedReason: RevokedReason.ROTATED },
      );
      expect(managerRepository.save.mock.invocationCallOrder[0]).toBeLessThan(
        managerRepository.update.mock.invocationCallOrder[0],
      );
    });

    it('answers 401 and rejects the transaction callback (rolling back) when a concurrent rotation won', async () => {
      managerRepository.update.mockResolvedValue({ affected: 0 });

      await expect(service.rotateTokens(user, presented)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
      await expect(transactionOutcome).rejects.toThrow(UnauthorizedException);
    });

    it('never revokes the presented row and propagates the error when the insert fails', async () => {
      managerRepository.save.mockRejectedValue(new Error('insert failed'));

      await expect(service.rotateTokens(user, presented)).rejects.toThrow('insert failed');
      await expect(transactionOutcome).rejects.toThrow('insert failed');
      expect(managerRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('hashToken', () => {
    it('returns the SHA-256 hex digest of the value', () => {
      expect(service.hashToken('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('is stable and matches a freshly computed digest', () => {
      const value = 'a-refresh-token';

      expect(service.hashToken(value)).toBe(
        createHash('sha256').update(value).digest('hex'),
      );
    });
  });
});
