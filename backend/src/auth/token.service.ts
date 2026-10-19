import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { hashToken } from '../core/token-hash.js';
import { RefreshToken, RevokedReason } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Identity of a session (one chain of rotated refresh tokens), copied onto the
 * replacement token on refresh so the session survives rotation.
 */
export interface SessionIdentity {
  sessionUuid: string;
  startedAt: Date;
}

/**
 * Session minting for the Auth module: signs the stateless access-token JWT
 * and persists a SHA-256-hashed rotating refresh token carrying its session
 * identity (`sessionUuid`/`startedAt`). Split out of `AuthService` so the
 * device-authorization flow can mint a login session byte-for-byte identical
 * to a password login without duplicating the logic (the two paths cannot
 * drift). Not exported from `AuthModule` — an internal collaborator only,
 * same as `PasswordResetService`. Depends only on injected repositories and
 * services — never reads env vars or global state directly (per
 * `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class TokenService {
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly jwtService: JwtService;

  /**
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {JwtService} jwtService - Signs the access token.
   */
  constructor(
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      jwtService: JwtService,
  ) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.jwtService = jwtService;
  }

  /**
   * Issues an access/refresh token pair for the given user: signs the
   * access-token JWT (`{ sub, username, isAdmin }`) and persists a new
   * SHA-256-hashed `RefreshToken` row (7-day TTL, `revokedAt: null`,
   * `revokedReason: null`). Shared by the password-login (`AuthService`) and
   * device-authorization paths so both mint sessions identically.
   * @param {User} user - The user to mint a session for.
   * @param {SessionIdentity} [session] - The existing session to continue
   *   (refresh rotation); without it, a new session starts (`randomUUID()`,
   *   `startedAt = now`).
   * @param {EntityManager} [manager] - Transactional entity manager to save
   *   the row through (atomic rotation); defaults to the injected repository.
   * @returns {Promise<AuthResult>} The user plus the freshly issued
   *   access/refresh token pair.
   */
  async issueTokens(user: User, session?: SessionIdentity, manager?: EntityManager): Promise<AuthResult> {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });
    const refreshToken = randomBytes(48).toString('hex');
    const repository = manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepository;
    const { sessionUuid, startedAt } = session ?? { sessionUuid: randomUUID(), startedAt: new Date() };

    await repository.save(
      repository.create({
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
        revokedReason: null,
        sessionUuid,
        startedAt,
      }),
    );

    return { user, accessToken, refreshToken };
  }

  /**
   * Rotates the presented refresh token atomically and single-winner, in one
   * transaction: inserts the replacement **first** (same `sessionUuid` /
   * `startedAt`), then revokes the presented row with `rotated` through a
   * conditional update (`WHERE id = ? AND revoked_at IS NULL`). If it affects
   * no row, a concurrent refresh with the same token already won: the throw
   * rolls the transaction back (dropping the replacement), so a session never
   * forks into two active rows. **Why insert first:** committing the revoke
   * before the insert would leave a moment with no active row, where an
   * in-flight request could get a false `401` whose refresh-and-retry then
   * replays the `rotated` token and logs the user out everywhere.
   * @param {User} user - The owner of the presented token.
   * @param {RefreshToken} presented - The presented (active) refresh-token row.
   * @returns {Promise<AuthResult>} The user plus the newly issued token pair.
   * @throws {UnauthorizedException} When a concurrent rotation already revoked the presented row.
   */
  async rotateTokens(user: User, presented: RefreshToken): Promise<AuthResult> {
    const session = { sessionUuid: presented.sessionUuid, startedAt: presented.startedAt };

    return this.refreshTokenRepository.manager.transaction(async (manager) => {
      const result = await this.issueTokens(user, session, manager);
      const { affected } = await manager.getRepository(RefreshToken).update(
        { id: presented.id, revokedAt: IsNull() },
        { revokedAt: new Date(), revokedReason: RevokedReason.ROTATED },
      );

      if (affected !== 1) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      return result;
    });
  }

  /**
   * Hashes a plaintext token with SHA-256, as stored in
   * `auth_refresh_tokens.token_hash`. Exposed (rather than kept private) so
   * `AuthService`'s refresh-token read paths hash exactly the same way the
   * mint path does — the two cannot drift.
   * @param {string} token - The plaintext token to hash.
   * @returns {string} The SHA-256 hex digest of the token.
   */
  hashToken(token: string): string {
    return hashToken(token);
  }
}
