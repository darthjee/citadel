import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { computeLockoutState } from '../core/lockout-state.js';
import { getNumberConfig } from '../core/numeric-config.js';
import { AccountEditLockout } from './entities/account-edit-lockout.entity.js';

// Default consecutive-failed-attempt threshold, per user, that trips the `PATCH
// /auth/account.json` cool-off, used when `CITADEL_PLACEHOLDER_ACCOUNT_EDIT_MAX_ATTEMPTS` is unset.
const DEFAULT_ACCOUNT_EDIT_MAX_ATTEMPTS = 5;

// Default cool-off duration (5 minutes, in milliseconds) used when
// `CITADEL_PLACEHOLDER_ACCOUNT_EDIT_LOCK_MS` is unset.
const DEFAULT_ACCOUNT_EDIT_LOCK_MS = 300000;

// MySQL's driver error code for a unique-index violation, used to detect the
// `registerFailure` insert race (see its JSDoc) without depending on the message text.
const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

/**
 * Brute-force cool-off lockout for `PATCH /auth/account.json`, mirroring
 * `AuthorizationRequestAbuseGuardService`'s `authorize` cool-off but keyed by `userId` against
 * its own table (`auth_account_edit_lockouts`) rather than a request row, since any failed
 * validation on this endpoint — wrong `currentPassword`, duplicate `username`/`email` — counts
 * toward the same per-user counter. Not exported from `AuthModule` — an internal collaborator
 * only, like `TokenService`. Depends only on injected repositories/services — never reads env
 * vars or global state directly (per `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class AccountEditAbuseGuardService {
  private readonly accountEditLockoutRepository: Repository<AccountEditLockout>;
  private readonly configService: ConfigService;

  /**
   * @param {Repository<AccountEditLockout>} accountEditLockoutRepository - The
   *   account-edit-lockout repository.
   * @param {ConfigService} configService - Supplies the max-attempts/lock-duration config keys.
   */
  constructor(
    @InjectRepository(AccountEditLockout) accountEditLockoutRepository: Repository<AccountEditLockout>,
      configService: ConfigService,
  ) {
    this.accountEditLockoutRepository = accountEditLockoutRepository;
    this.configService = configService;
  }

  /**
   * Reports whether `userId` is currently within its `PATCH /auth/account.json` cool-off lockout
   * window. A user with no lockout row yet is never locked out.
   * @param {number} userId - The authenticated user's ID.
   * @returns {Promise<boolean>} Whether the user's `lockedUntil` is set and still in the future.
   */
  async isLockedOut(userId: number): Promise<boolean> {
    const lockout = await this.accountEditLockoutRepository.findOne({ where: { userId } });

    return lockout !== null && lockout.lockedUntil !== null && lockout.lockedUntil > new Date();
  }

  /**
   * Records one more failed `PATCH /auth/account.json` attempt for `userId`, creating the
   * user's lockout row on the first failure, and locking it (setting `lockedUntil`) once the
   * configured max-attempts threshold is reached. `userId` is uniquely indexed, so two
   * concurrent first failures for the same user can both race past the initial lookup finding no
   * row; the loser's insert is caught and retried as an update against the winner's now-existing
   * row instead of propagating an unhandled unique-constraint error and silently dropping the
   * attempt.
   * @param {number} userId - The authenticated user's ID.
   * @returns {Promise<void>} Resolves once the user's attempt counter (and lock, if tripped) is persisted.
   */
  async registerFailure(userId: number): Promise<void> {
    const lockout = await this.accountEditLockoutRepository.findOne({ where: { userId } });

    if (lockout) {
      await this.#applyFailure(lockout.id, lockout.failedAttempts);

      return;
    }

    await this.#insertFirstFailure(userId);
  }

  /**
   * Clears `userId`'s failed-attempts counter and lock, called after a successful account
   * update. A no-op when the user has no lockout row.
   * @param {number} userId - The authenticated user's ID.
   * @returns {Promise<void>} Resolves once the reset (if any) is persisted.
   */
  async reset(userId: number): Promise<void> {
    const lockout = await this.accountEditLockoutRepository.findOne({ where: { userId } });

    if (lockout) {
      await this.accountEditLockoutRepository.update(lockout.id, { failedAttempts: 0, lockedUntil: null });
    }
  }

  async #applyFailure(id: number, currentAttempts: number): Promise<void> {
    const { attempts, lockedUntil } = this.#nextAttemptState(currentAttempts);

    await this.accountEditLockoutRepository.update(id, { failedAttempts: attempts, lockedUntil });
  }

  async #insertFirstFailure(userId: number): Promise<void> {
    const { attempts, lockedUntil } = this.#nextAttemptState(0);

    try {
      await this.accountEditLockoutRepository.save(
        this.accountEditLockoutRepository.create({ userId, failedAttempts: attempts, lockedUntil }),
      );
    } catch (error) {
      await this.#recoverFromInsertRace(userId, error);
    }
  }

  async #recoverFromInsertRace(userId: number, error: unknown): Promise<void> {
    if (!this.#isDuplicateUserIdError(error)) {
      throw error;
    }

    const lockout = await this.accountEditLockoutRepository.findOne({ where: { userId } });

    if (lockout) {
      await this.#applyFailure(lockout.id, lockout.failedAttempts);
    }
  }

  #isDuplicateUserIdError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError: unknown = error.driverError;

    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === MYSQL_DUPLICATE_ENTRY_CODE
    );
  }

  #nextAttemptState(currentAttempts: number): { attempts: number; lockedUntil: Date | null } {
    return computeLockoutState(currentAttempts, this.#maxAttempts(), this.#lockMs());
  }

  #maxAttempts(): number {
    return getNumberConfig(this.configService, 'CITADEL_PLACEHOLDER_ACCOUNT_EDIT_MAX_ATTEMPTS', DEFAULT_ACCOUNT_EDIT_MAX_ATTEMPTS);
  }

  #lockMs(): number {
    return getNumberConfig(this.configService, 'CITADEL_PLACEHOLDER_ACCOUNT_EDIT_LOCK_MS', DEFAULT_ACCOUNT_EDIT_LOCK_MS);
  }
}
