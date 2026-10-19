import type { SessionLookup, SessionUser } from '../../../core/session-lookup.js';
import type { RefreshToken } from '../../entities/refresh-token.entity.js';
import type { User } from '../../entities/user.entity.js';

// In-memory stand-in for `SessionService` (the `SESSION_LOOKUP` provider) in
// the e2e harnesses: the real implementation runs a query-builder join of
// `auth_users` with `auth_refresh_tokens`, which the per-entity in-memory
// repos (`createInMemoryRepo()`) cannot execute. It applies the same rules
// over the repos' live `rows` arrays — an active session is a refresh-token
// row with `sessionUuid === sid`, not revoked and not expired; its user is the
// row with `id === userId`. The real query shape is covered by
// `session.service.spec.ts`. No `status` rule yet (#5 adds it). Mirrors
// https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/support/in-memory-session-lookup.ts
export class InMemorySessionLookup implements SessionLookup {
  private readonly users: User[];
  private readonly refreshTokens: RefreshToken[];

  constructor(users: User[], refreshTokens: RefreshToken[]) {
    this.users = users;
    this.refreshTokens = refreshTokens;
  }

  async findActiveSessionUser(sid: string): Promise<SessionUser | null> {
    const now = new Date();
    const session = this.refreshTokens.find(
      (row) => row.sessionUuid === sid && !row.revokedAt && row.expiresAt > now,
    );
    const user = session && this.users.find((candidate) => candidate.id === session.userId);

    return user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null;
  }
}
