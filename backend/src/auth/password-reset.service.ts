import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { RecoverDto } from './dto/recover.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { User } from './entities/user.entity.js';
import { PasswordRecoveryRequestedEvent } from './events/password-recovery-requested.event.js';
import { LoggerService } from '../core/logger.service.js';
import { hashToken } from '../core/token-hash.js';

// Default password-reset-token lifetime (30 minutes, in milliseconds) used
// when `CITADEL_PLACEHOLDER_PASSWORD_RESET_TOKEN_TTL_MS` is unset.
const DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * The self-service password recovery flow's business logic — the private
 * helper `AuthService` delegates to (per the issue's "logic living in
 * `AuthService` (or a private helper it delegates to)" decision), split out
 * purely to keep `auth.service.ts` under the project's 300-line-per-file
 * convention. Not exported from `AuthModule` — an internal collaborator of
 * `AuthService` only, never injected elsewhere.
 */
@Injectable()
export class PasswordResetService {
  private readonly userRepository: Repository<User>;
  private readonly passwordResetTokenRepository: Repository<PasswordResetToken>;
  private readonly eventEmitter: EventEmitter2;
  private readonly configService: ConfigService;
  private readonly logger: LoggerService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {Repository<PasswordResetToken>} passwordResetTokenRepository - The
   *   password-reset-token repository.
   * @param {EventEmitter2} eventEmitter - Fires the `password-recovery.requested` event.
   * @param {ConfigService} configService - Supplies `FRONTEND_BASE_URL` and
   *   the password-reset-token TTL.
   * @param {LoggerService} logger - The injected Core logger.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken) passwordResetTokenRepository: Repository<PasswordResetToken>,
      eventEmitter: EventEmitter2,
      configService: ConfigService,
      logger: LoggerService,
  ) {
    this.userRepository = userRepository;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
    this.eventEmitter = eventEmitter;
    this.configService = configService;
    this.logger = logger;
  }

  /**
   * Starts a self-service password recovery: when `dto.email` matches an
   * account, a single-use `PasswordResetToken` is created and a
   * `password-recovery.requested` event is fired (consumed later by #39).
   * Never throws and never branches its return value on whether the email
   * matched — callers must respond identically either way, per the
   * enumeration-safety contract (see `docs/agents/product.md`).
   * @param {RecoverDto} dto - Carries the email to look up.
   * @returns {Promise<void>} Resolves once the (possible) token/event have
   *   been created, whether or not the email matched an account.
   */
  async recover(dto: RecoverDto): Promise<void> {
    this.logger.info('password recovery requested', { context: 'PasswordResetService' });

    const user = await this.userRepository.findOneBy({ email: dto.email });

    if (!user) {
      this.logger.info('password recovery user not found', {
        context: 'PasswordResetService',
        email: dto.email,
      });
      return;
    }

    this.logger.info('password recovery user found', {
      context: 'PasswordResetService',
      email: dto.email,
      userId: user.id,
    });

    const { token, resetUrl } = await this.issueToken(user);

    this.eventEmitter.emit(
      'password-recovery.requested',
      new PasswordRecoveryRequestedEvent(user.id, token, resetUrl, user.email),
    );
  }

  /**
   * Mints a fresh single-use `PasswordResetToken` for the given user and
   * builds its recovery URL, without emitting any event or otherwise
   * assuming a self-service caller — shared by `recover()` (self-service)
   * and the admin recovery-link/send-recovery-email flows, so both mint
   * tokens the exact same way (same TTL config key, same hashing, same
   * `resetUrl` format).
   * @param {User} user - The user to mint a password-reset token for.
   * @returns {Promise<{ token: string; resetUrl: string }>} The plaintext
   *   token (never persisted — only its hash is stored) and the URL built
   *   from it.
   */
  async issueToken(user: User): Promise<{ token: string; resetUrl: string }> {
    const token = randomBytes(48).toString('hex');
    const ttlMs = this.configService.get<number>(
      'CITADEL_PLACEHOLDER_PASSWORD_RESET_TOKEN_TTL_MS',
      DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS,
    );

    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
        usedAt: null,
      }),
    );

    const resetUrl = `${this.configService.get<string>('FRONTEND_BASE_URL')}/#/recover-password?token=${token}`;

    return { token, resetUrl };
  }

  /**
   * Validates a password-reset token, updates the matching user's password,
   * and marks the token used (so it can't be replayed). Every rejection
   * reason (unknown token, already-used token, expired token) collapses
   * into the same generic error, per the issue's uniform-error contract —
   * the client never learns which case it hit.
   * @param {ResetPasswordDto} dto - Carries the token and the new password.
   * @returns {Promise<number>} The ID of the user whose password was reset,
   *   so the caller (`AuthService`) can revoke that user's other sessions.
   * @throws {BadRequestException} When the token is unknown, already used, or expired.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<number> {
    const tokenRow = await this.#findActiveToken(dto.token);
    const passwordDigest = await bcrypt.hash(dto.password, 10);

    await this.userRepository.update(tokenRow.userId, { passwordDigest });
    await this.passwordResetTokenRepository.update(tokenRow.id, { usedAt: new Date() });

    return tokenRow.userId;
  }

  async #findActiveToken(token: string): Promise<PasswordResetToken> {
    const tokenHash = hashToken(token);
    const tokenRow = await this.passwordResetTokenRepository.findOneBy({ tokenHash });

    if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    return tokenRow;
  }
}
