import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from '../../../database/tests/integration/test-data-source.js';
import { RefreshToken, RevokedReason } from '../../entities/refresh-token.entity.js';
import { User, UserStatus } from '../../entities/user.entity.js';
import { TokenService } from '../../token.service.js';

const RACE_ROUNDS = 5;

describe('TokenService#rotateTokens (MySQL)', () => {
  let ds: DataSource;
  let users: Repository<User>;
  let tokens: Repository<RefreshToken>;
  let service: TokenService;
  let user: User;

  beforeAll(async () => {
    ds = await createTestDataSource();
    await resetDatabase(ds);
    await ds.runMigrations();

    users = ds.getRepository(User);
    tokens = ds.getRepository(RefreshToken);
    service = new TokenService(tokens, new JwtService({ secret: 'integration-test-secret' }));
    user = await users.save(users.create({
      username: 'rotator',
      email: 'rotator@example.test',
      passwordDigest: 'digest',
      status: UserStatus.APPROVED,
    }));
  });

  afterAll(async () => {
    await ds.destroy();
  });

  /**
   * Inserts a fresh active refresh-token row for `user`, starting its own session.
   *
   * @param revokedAt - set to pre-revoke the row.
   * @returns the row as loaded back from MySQL.
   */
  async function seedToken(revokedAt: Date | null = null): Promise<RefreshToken> {
    const saved = await tokens.save(tokens.create({
      tokenHash: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt,
      revokedReason: revokedAt ? RevokedReason.LOGOUT : null,
      sessionUuid: randomUUID(),
      startedAt: new Date('2026-01-01T00:00:00Z'),
    }));
    return tokens.findOneByOrFail({ id: saved.id });
  }

  it('lets exactly one of two concurrent rotations of the same token win', async () => {
    for (let round = 0; round < RACE_ROUNDS; round++) {
      const presented = await seedToken();
      const countBefore = await tokens.count();

      const results = await Promise.allSettled([
        service.rotateTokens(user, presented),
        service.rotateTokens(user, presented),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);

      const session = await tokens.findBy({ sessionUuid: presented.sessionUuid });
      expect(session.filter(({ revokedAt }) => revokedAt === null)).toHaveLength(1);
      expect(session.find(({ id }) => id === presented.id)).toMatchObject({
        revokedReason: RevokedReason.ROTATED,
      });
      expect(session.find(({ id }) => id === presented.id)?.revokedAt).not.toBeNull();
      expect(await tokens.count()).toBe(countBefore + 1);
    }
  });

  it('rolls the replacement back when the presented token is already revoked', async () => {
    const revokedAt = new Date('2026-03-01T12:00:00Z');
    const presented = await seedToken(revokedAt);
    const countBefore = await tokens.count();

    await expect(service.rotateTokens(user, presented)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(await tokens.count()).toBe(countBefore);
    expect(await tokens.findBy({ sessionUuid: presented.sessionUuid })).toEqual([
      expect.objectContaining({
        id: presented.id,
        revokedAt: presented.revokedAt,
        revokedReason: RevokedReason.LOGOUT,
      }),
    ]);
  });
});
