import { randomUUID } from 'node:crypto';
import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from '../../../database/tests/integration/test-data-source.js';
import { RefreshToken, RevokedReason } from '../../entities/refresh-token.entity.js';
import { User, UserStatus } from '../../entities/user.entity.js';
import { SessionService } from '../../session.service.js';

const HOUR_MS = 60 * 60 * 1000;

describe('SessionService#findActiveSessionUser (MySQL)', () => {
  let ds: DataSource;
  let users: Repository<User>;
  let tokens: Repository<RefreshToken>;
  let service: SessionService;

  beforeAll(async () => {
    ds = await createTestDataSource();
    await resetDatabase(ds);
    await ds.runMigrations();

    users = ds.getRepository(User);
    tokens = ds.getRepository(RefreshToken);
    service = new SessionService(users);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  /**
   * Inserts a user with the given status.
   *
   * @param status - the account status.
   * @param isAdmin - the admin flag.
   * @returns the saved user.
   */
  async function seedUser(status: UserStatus, isAdmin = false): Promise<User> {
    const username = `user-${randomUUID()}`;
    return users.save(users.create({
      username,
      email: `${username}@example.test`,
      passwordDigest: 'digest',
      isAdmin,
      status,
    }));
  }

  /**
   * Inserts a refresh-token row for `user` and returns its session UUID.
   *
   * @param user - the session's owner.
   * @param overrides - expiry / revocation overrides.
   * @param overrides.expiresAt - when the token expires (defaults to an hour from now).
   * @param overrides.revoked - whether the token is revoked.
   * @returns the row's `session_uuid`.
   */
  async function seedSession(
    user: User,
    { expiresAt = new Date(Date.now() + HOUR_MS), revoked = false }: { expiresAt?: Date; revoked?: boolean } = {},
  ): Promise<string> {
    const sessionUuid = randomUUID();
    await tokens.save(tokens.create({
      tokenHash: randomUUID(),
      userId: user.id,
      expiresAt,
      revokedAt: revoked ? new Date() : null,
      revokedReason: revoked ? RevokedReason.LOGOUT : null,
      sessionUuid,
      startedAt: new Date(),
    }));
    return sessionUuid;
  }

  it('returns the user of an active session of an approved user', async () => {
    const user = await seedUser(UserStatus.APPROVED);
    const sid = await seedSession(user);

    expect(await service.findActiveSessionUser(sid)).toEqual({
      id: user.id,
      username: user.username,
      isAdmin: false,
    });
  });

  it('reads isAdmin fresh from the user row', async () => {
    const user = await seedUser(UserStatus.APPROVED);
    const sid = await seedSession(user);
    await users.update({ id: user.id }, { isAdmin: true });

    expect(await service.findActiveSessionUser(sid)).toEqual({
      id: user.id,
      username: user.username,
      isAdmin: true,
    });
  });

  it('returns null for a revoked session', async () => {
    const sid = await seedSession(await seedUser(UserStatus.APPROVED), { revoked: true });

    expect(await service.findActiveSessionUser(sid)).toBeNull();
  });

  it('returns null for an expired session', async () => {
    const sid = await seedSession(await seedUser(UserStatus.APPROVED), {
      expiresAt: new Date(Date.now() - HOUR_MS),
    });

    expect(await service.findActiveSessionUser(sid)).toBeNull();
  });

  it('returns null for an unknown sid', async () => {
    await seedSession(await seedUser(UserStatus.APPROVED));

    expect(await service.findActiveSessionUser(randomUUID())).toBeNull();
  });

  it.each([UserStatus.PENDING, UserStatus.DENIED])('returns null for a %s user', async (status) => {
    const sid = await seedSession(await seedUser(status));

    expect(await service.findActiveSessionUser(sid)).toBeNull();
  });
});
