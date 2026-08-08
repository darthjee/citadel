import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { IsNull, Not, Repository } from 'typeorm';
import { ErrorCodes } from '../core/error-codes.js';
import { LoginDto } from './dto/login.dto.js';
import { RecoverDto } from './dto/recover.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { compareOrDummy } from './dummy-digest.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';
import { UserRegisteredEvent } from './events/user-registered.event.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenService, type AuthResult } from './token.service.js';

export type { AuthResult };

// Specific error code attached to the `409` thrown when a field's value is taken.
const TAKEN_CODES = { username: ErrorCodes.USERNAME_TAKEN, email: ErrorCodes.EMAIL_TAKEN } as const;

/**
 * Auth module business logic: credential verification, registration,
 * stateless-JWT issuance, and refresh-token rotation. Ported from the old
 * `Authenticator`/`Registrar` (`backend/lib/accounts/`), adapted to NestJS
 * DI and TypeORM repositories. Depends only on injected repositories and
 * services — never reads env vars or global state directly (per
 * `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class AuthService {
  private readonly userRepository: Repository<User>;
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly tokenService: TokenService;
  private readonly eventEmitter: EventEmitter2;
  private readonly passwordResetService: PasswordResetService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {TokenService} tokenService - Mints login sessions (access-token
   *   JWT, rotating refresh token, `auth_sessions` row) and hashes refresh
   *   tokens for the read paths.
   * @param {EventEmitter2} eventEmitter - Fires the `user.registered` event.
   * @param {PasswordResetService} passwordResetService - The password
   *   recovery/reset flow's business logic, delegated to for `recover`/
   *   `resetPassword`.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      tokenService: TokenService,
      eventEmitter: EventEmitter2,
      passwordResetService: PasswordResetService,
  ) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
    this.eventEmitter = eventEmitter;
    this.passwordResetService = passwordResetService;
  }

  /**
   * Registers a new user and immediately logs them in (issues tokens),
   * per the issue's JWT flow ("issued on login/register/refresh").
   * @param {RegisterDto} dto - The registration payload.
   * @returns {Promise<AuthResult>} The created user plus access/refresh tokens.
   * @throws {ConflictException} When the username/email are already taken (`USERNAME_TAKEN`/`EMAIL_TAKEN`).
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    await this.#assertAvailable(dto.username, dto.email);

    const passwordDigest = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({
        username: dto.username,
        email: dto.email,
        passwordDigest,
        isAdmin: false,
      }),
    );

    this.eventEmitter.emit(
      'user.registered',
      new UserRegisteredEvent(user.id, user.username, user.email),
    );

    return this.tokenService.issueTokens(user);
  }

  /**
   * Verifies a username/password pair and issues a fresh token pair.
   * @param {LoginDto} dto - The login credentials.
   * @returns {Promise<AuthResult>} The authenticated user plus access/refresh tokens.
   * @throws {UnauthorizedException} When the username is unknown or the password is wrong.
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.#validateCredentials(dto.username, dto.password);

    return this.tokenService.issueTokens(user);
  }

  /**
   * Starts a self-service password recovery. Delegates entirely to
   * `PasswordResetService#recover` — see its doc-comment for the
   * enumeration-safety contract this must uphold.
   * @param {RecoverDto} dto - Carries the email to look up.
   * @returns {Promise<void>} Resolves once the (possible) token/event have
   *   been created, whether or not the email matched an account.
   */
  async recover(dto: RecoverDto): Promise<void> {
    return this.passwordResetService.recover(dto);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new
   * access/refresh pair is issued, preventing replay of the old one.
   *
   * Presenting a token that is specifically already-revoked (as opposed to
   * merely expired) is treated as a compromise signal per standard
   * refresh-token-rotation guidance: it means someone is replaying a token
   * whose rotated successor already exists, so every other currently-active
   * refresh token belonging to that user is revoked too, forcing re-login,
   * before the 401 is thrown.
   * @param {string} refreshToken - The refresh token presented by the client.
   * @returns {Promise<AuthResult>} The user plus the newly issued token pair.
   * @throws {UnauthorizedException} When the token is unknown, expired, or already revoked.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenRow = await this.#findActiveRefreshToken(refreshToken);
    const user = await this.userRepository.findOneBy({ id: tokenRow.userId });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepository.update(tokenRow.id, { revokedAt: new Date() });

    return this.tokenService.issueTokens(user);
  }

  /**
   * Invalidates a refresh token server-side, ending the session it
   * belongs to.
   * @param {string} refreshToken - The refresh token to invalidate.
   * @returns {Promise<void>} Resolves once the token has been revoked.
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(refreshToken);

    await this.refreshTokenRepository.update({ tokenHash }, { revokedAt: new Date() });
  }

  /**
   * Finishes a self-service password recovery: validates the token (via
   * `PasswordResetService#resetPassword`, which throws the uniform
   * rejection error), then revokes every other refresh token belonging to
   * that user, forcing re-login on all of that user's other sessions.
   * @param {ResetPasswordDto} dto - Carries the token and the new password.
   * @returns {Promise<void>} Resolves once the password has been reset and
   *   the user's other sessions revoked.
   * @throws {BadRequestException} When the token is unknown, already used, or expired.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.passwordResetService.resetPassword(dto);

    await this.#revokeTokenFamily(userId);
  }

  /**
   * Reports whether a refresh token currently identifies an active
   * session, without mutating anything. Deliberately distinct from
   * `#findActiveRefreshToken` (used by `refresh()`), which revokes the
   * user's entire token family and throws when it finds an
   * already-revoked token — the correct replay-detection behavior for a
   * token-consuming flow, but unsafe to reuse here: a passive status check
   * must never revoke or rotate anything, or a second tab's routine
   * mount-time confirmation could log every tab out after the first tab's
   * legitimate refresh.
   * @param {string} refreshToken - The refresh token presented by the client.
   * @returns {Promise<{ loggedIn: boolean; isAdmin: boolean }>} `{ loggedIn:
   *   true, isAdmin }` (resolved from the token's user) when active; `{
   *   loggedIn: false, isAdmin: false }` otherwise, with no extra query.
   */
  async status(refreshToken: string): Promise<{ loggedIn: boolean; isAdmin: boolean }> {
    const tokenRow = await this.#findActiveTokenRow(refreshToken);

    if (!tokenRow) {
      return { loggedIn: false, isAdmin: false };
    }

    const user = await this.userRepository.findOneBy({ id: tokenRow.userId });

    return { loggedIn: true, isAdmin: user?.isAdmin ?? false };
  }

  /**
   * Checks that a username/email are available for a user to claim,
   * excluding that user's own row (so "changing" a field to its current
   * value never false-positives). Used by `AccountService`; kept separate
   * from `#assertAvailable` for its distinct error messages.
   * @param {number} excludeUserId - Id of the user updating their account, excluded from the lookup.
   * @param {string} [username] - Candidate username, when being changed.
   * @param {string} [email] - Candidate email, when being changed.
   * @returns {Promise<void>} Resolves once the provided values are confirmed available.
   * @throws {ConflictException} `'Username already in use'` (`USERNAME_TAKEN`) or
   *   `'Email already in use'` (`EMAIL_TAKEN`).
   */
  async assertAvailableForUpdate(
    excludeUserId: number,
    username?: string,
    email?: string,
  ): Promise<void> {
    if (username) {
      await this.#assertFieldAvailable('username', username, excludeUserId, 'Username already in use');
    }

    if (email) {
      await this.#assertFieldAvailable('email', email, excludeUserId, 'Email already in use');
    }
  }

  async #assertAvailable(username: string, email: string): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    if (!existing) {
      return;
    }

    const field = existing.username === username ? 'username' : 'email';
    throw new ConflictException({ code: TAKEN_CODES[field], message: `${field} is not available` });
  }

  async #assertFieldAvailable(
    field: 'username' | 'email',
    value: string,
    excludeUserId: number,
    message: string,
  ): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { [field]: value, id: Not(excludeUserId) },
    });

    if (existing) {
      throw new ConflictException({ code: TAKEN_CODES[field], message });
    }
  }

  async #findActiveRefreshToken(refreshToken: string): Promise<RefreshToken> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const tokenRow = await this.refreshTokenRepository.findOneBy({ tokenHash });

    if (!tokenRow) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenRow.revokedAt) {
      await this.#revokeTokenFamily(tokenRow.userId);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return tokenRow;
  }

  async #findActiveTokenRow(refreshToken: string): Promise<RefreshToken | null> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const tokenRow = await this.refreshTokenRepository.findOneBy({ tokenHash });
    const isActive = !!tokenRow && !tokenRow.revokedAt && tokenRow.expiresAt > new Date();

    return isActive ? tokenRow : null;
  }

  async #revokeTokenFamily(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async #validateCredentials(username: string, password: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ username });
    const valid = await compareOrDummy(password, user?.passwordDigest);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return user;
  }
}
