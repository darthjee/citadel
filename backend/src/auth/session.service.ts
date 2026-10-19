import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SessionLookup, SessionUser } from '../core/session-lookup.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { User, UserStatus } from './entities/user.entity.js';

/**
 * The Auth module's implementation of Core's `SESSION_LOOKUP` port, used by
 * `JwtGuard` on every authenticated request. Resolves a session UUID to the
 * user owning that session while it is active, in **one** query on the
 * indexed `session_uuid` column: a join of `auth_users` with
 * `auth_refresh_tokens` — an in-module join (both `auth_` tables), so it does
 * not break the no-cross-module-JOIN rule. Database errors propagate (the
 * guard answers `500`, never a misleading `401`). Only `approved` users are
 * authenticated: a pending or denied user's session resolves to `null` (the
 * guard's plain `401`), whatever the approval flag, and an approval lets the
 * **same** access token pass on the next request. Ported from Kerghan's
 * https://github.com/darthjee/kerghan/blob/main/backend/src/auth/session.service.ts
 * (only `findActiveSessionUser`; Citadel has no session list/revoke endpoints).
 */
@Injectable()
export class SessionService implements SessionLookup {
  private readonly userRepository: Repository<User>;

  /**
   * @param {Repository<User>} userRepository - The user repository.
   */
  constructor(@InjectRepository(User) userRepository: Repository<User>) {
    this.userRepository = userRepository;
  }

  /**
   * Finds the `approved` user owning the active (non-revoked, unexpired)
   * session identified by `sid`.
   * @param {string} sid - The session UUID carried by the access token.
   * @returns {Promise<SessionUser | null>} The session's user (fresh
   *   `username`/`isAdmin`), or `null` when no active session matches or its
   *   user is not `approved`.
   */
  async findActiveSessionUser(sid: string): Promise<SessionUser | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin(RefreshToken, 'session', 'session.userId = user.id')
      .select(['user.id', 'user.username', 'user.isAdmin'])
      .where('session.sessionUuid = :sid', { sid })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: new Date() })
      .andWhere('user.status = :status', { status: UserStatus.APPROVED })
      .getOne();

    return user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null;
  }
}
