import { RefreshToken } from '../entities/refresh-token.entity.js';
import { User, UserStatus } from '../entities/user.entity.js';
import { SessionService } from '../session.service.js';

const SID = '3f2b8c1e-9d4a-4e6b-8a1f-2c5d7e9f0a1b';

type QueryBuilderDouble = Record<'innerJoin' | 'select' | 'where' | 'andWhere' | 'getOne', jest.Mock>;

function queryBuilder(result: Promise<unknown>): QueryBuilderDouble {
  const builder = {} as QueryBuilderDouble;

  for (const method of ['innerJoin', 'select', 'where', 'andWhere'] as const) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.getOne = jest.fn().mockReturnValue(result);

  return builder;
}

describe('SessionService', () => {
  let builder: QueryBuilderDouble;
  let userRepository: { createQueryBuilder: jest.Mock };
  let service: SessionService;

  function build(result: Promise<unknown>): void {
    builder = queryBuilder(result);
    userRepository = { createQueryBuilder: jest.fn().mockReturnValue(builder) };
    service = new SessionService(userRepository as never);
  }

  describe('findActiveSessionUser', () => {
    describe('when an active session matches', () => {
      const row = { id: 7, username: 'darthjee', isAdmin: true, email: 'x@example.com' } as User;

      beforeEach(() => build(Promise.resolve(row)));

      it('maps the row to a SessionUser with only id, username and isAdmin', async () => {
        await expect(service.findActiveSessionUser(SID)).resolves.toEqual({
          id: 7,
          username: 'darthjee',
          isAdmin: true,
        });
      });

      it('queries users aliased as user', async () => {
        await service.findActiveSessionUser(SID);

        expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      });

      it('inner-joins the refresh tokens on the session owner', async () => {
        await service.findActiveSessionUser(SID);

        expect(builder.innerJoin).toHaveBeenCalledWith(RefreshToken, 'session', 'session.userId = user.id');
      });

      it('selects only id, username and isAdmin', async () => {
        await service.findActiveSessionUser(SID);

        expect(builder.select).toHaveBeenCalledWith(['user.id', 'user.username', 'user.isAdmin']);
      });

      it('filters by the session uuid', async () => {
        await service.findActiveSessionUser(SID);

        expect(builder.where).toHaveBeenCalledWith('session.sessionUuid = :sid', { sid: SID });
      });

      it('filters out revoked sessions', async () => {
        await service.findActiveSessionUser(SID);

        expect(builder.andWhere).toHaveBeenCalledWith('session.revokedAt IS NULL');
      });

      it('filters out expired sessions, comparing against now', async () => {
        const before = Date.now();

        await service.findActiveSessionUser(SID);

        const call = builder.andWhere.mock.calls.find(([clause]) => clause === 'session.expiresAt > :now');
        const after = Date.now();

        expect(call).toBeDefined();
        expect(call[1].now).toBeInstanceOf(Date);
        expect(call[1].now.getTime()).toBeGreaterThanOrEqual(before);
        expect(call[1].now.getTime()).toBeLessThanOrEqual(after);
      });

      it('requires the user to be approved', async () => {
        await service.findActiveSessionUser(SID);

        expect(builder.andWhere).toHaveBeenCalledWith('user.status = :status', { status: UserStatus.APPROVED });
        expect(UserStatus.APPROVED).toBe('approved');
      });

      it('runs a single query', async () => {
        await service.findActiveSessionUser(SID);

        expect(builder.getOne).toHaveBeenCalledTimes(1);
      });
    });

    describe('when no active session of an approved user matches (e.g. pending or denied)', () => {
      beforeEach(() => build(Promise.resolve(null)));

      it('returns null', async () => {
        await expect(service.findActiveSessionUser(SID)).resolves.toBeNull();
      });
    });

    describe('when the query fails', () => {
      it('propagates the error', async () => {
        const failure = new Error('database unavailable');
        build(Promise.reject(failure));

        await expect(service.findActiveSessionUser(SID)).rejects.toBe(failure);
      });
    });
  });
});
