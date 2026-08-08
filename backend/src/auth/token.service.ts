import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashToken } from '../core/token-hash.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { Session } from './entities/session.entity.js';
import { User } from './entities/user.entity.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Session minting for the Auth module: signs the stateless access-token JWT,
 * persists a SHA-256-hashed rotating refresh token, and writes the
 * `auth_sessions` bookkeeping row. Split out of `AuthService` so the
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
  private readonly sessionRepository: Repository<Session>;
  private readonly jwtService: JwtService;

  /**
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {Repository<Session>} sessionRepository - The session repository.
   * @param {JwtService} jwtService - Signs the access token.
   */
  constructor(
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Session) sessionRepository: Repository<Session>,
      jwtService: JwtService,
  ) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.sessionRepository = sessionRepository;
    this.jwtService = jwtService;
  }

  /**
   * Mints a fresh login session for the given user: signs the access-token
   * JWT (`{ sub, username, isAdmin }`), persists a new SHA-256-hashed
   * `RefreshToken` row (7-day TTL, `revokedAt: null`), and writes an
   * `auth_sessions` bookkeeping row. Shared by the password-login
   * (`AuthService`) and device-authorization paths so both mint sessions
   * identically.
   * @param {User} user - The user to mint a session for.
   * @returns {Promise<AuthResult>} The user plus the freshly issued
   *   access/refresh token pair.
   */
  async issueTokens(user: User): Promise<AuthResult> {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });
    const refreshToken = randomBytes(48).toString('hex');

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
      }),
    );

    await this.#touchSession(user.id);

    return { user, accessToken, refreshToken };
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

  async #touchSession(userId: number): Promise<void> {
    await this.sessionRepository.save(
      this.sessionRepository.create({ userId, lastSeenAt: new Date() }),
    );
  }
}
