import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('TokenService', () => {
  let refreshTokenRepository: RepoMock<RefreshToken>;
  let sessionRepository: RepoMock<Session>;
  let jwtService: { sign: jest.Mock };
  let service: TokenService;

  beforeEach(() => {
    refreshTokenRepository = repoMock<RefreshToken>();
    sessionRepository = repoMock<Session>();
    jwtService = { sign: jest.fn().mockReturnValue('signed-access-token') };

    service = new TokenService(
      refreshTokenRepository as never,
      sessionRepository as never,
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

    it('signs the access token with the user sub, username and isAdmin claims', async () => {
      await service.issueTokens(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 7,
        username: 'darthjee',
        isAdmin: false,
      });
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

    it('writes an auth_sessions bookkeeping row for the user', async () => {
      await service.issueTokens(user);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, lastSeenAt: expect.any(Date) }),
      );
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
