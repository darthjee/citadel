import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AccountEditAbuseGuardService } from './account-edit-abuse-guard.service.js';
import { assertAnyFieldPresent } from './assert-any-field-present.js';
import { AuthService } from './auth.service.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { User } from './entities/user.entity.js';
import { AccountSummary, UserUpdateService } from './user-update.service.js';
import { LockedException } from '../core/locked.exception.js';

/**
 * The self-service "My Account" update flow's business logic (`PATCH
 * /auth/account.json`), split into its own service rather than growing
 * `AuthService` further (already near the project's 300-line-per-file
 * convention — see `docs/agents/plans/.../backend.md`'s Notes).
 */
@Injectable()
export class AccountService {
  private readonly userRepository: Repository<User>;
  private readonly authService: AuthService;
  private readonly userUpdateService: UserUpdateService;
  private readonly accountEditAbuseGuardService: AccountEditAbuseGuardService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {AuthService} authService - Supplies the self-exclusion
   *   username/email availability check for updates.
   * @param {UserUpdateService} userUpdateService - Applies/hashes/persists
   *   the requested changes, shared with `AdminService#editUser`.
   * @param {AccountEditAbuseGuardService} accountEditAbuseGuardService - Tracks and enforces
   *   the per-user brute-force cool-off lockout for this endpoint.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      authService: AuthService,
      userUpdateService: UserUpdateService,
      accountEditAbuseGuardService: AccountEditAbuseGuardService,
  ) {
    this.userRepository = userRepository;
    this.authService = authService;
    this.userUpdateService = userUpdateService;
    this.accountEditAbuseGuardService = accountEditAbuseGuardService;
  }

  /**
   * Updates the caller's own username, email, and/or password, always
   * confirmed by their current password. Leaves other active sessions
   * (refresh tokens) untouched — deliberately, per the issue's Expected
   * Behavior — unlike the password-recovery reset flow. Any failed
   * validation (wrong current password, duplicate username/email) counts
   * toward a per-user cool-off lockout, checked before any other validation
   * runs and reset on success (see `AccountEditAbuseGuardService`).
   * @param {number} userId - The id of the authenticated user (from the access-token session).
   * @param {UpdateAccountDto} dto - The requested changes plus the current password.
   * @returns {Promise<AccountSummary>} The user's resulting username and email.
   * @throws {BadRequestException} When no field is being changed or the
   *   current password is wrong.
   * @throws {ConflictException} When the new username/email is already taken.
   * @throws {LockedException} `423 Locked` when the caller's per-user cool-off
   *   lockout is currently active.
   */
  async updateAccount(userId: number, dto: UpdateAccountDto): Promise<AccountSummary> {
    assertAnyFieldPresent(dto);
    await this.#assertNotLockedOut(userId);

    const user = await this.#loadUser(userId);
    await this.#applyGuardedChecks(user, dto);

    const result = await this.userUpdateService.applyUserUpdate(user, dto);
    await this.accountEditAbuseGuardService.reset(userId);

    return result;
  }

  async #assertNotLockedOut(userId: number): Promise<void> {
    if (await this.accountEditAbuseGuardService.isLockedOut(userId)) {
      throw new LockedException('Account temporarily locked due to too many failed attempts');
    }
  }

  async #applyGuardedChecks(user: User, dto: UpdateAccountDto): Promise<void> {
    try {
      await this.#verifyCurrentPassword(user, dto.currentPassword);
      await this.#assertNewValuesAvailable(user, dto);
    } catch (error) {
      await this.accountEditAbuseGuardService.registerFailure(user.id);
      throw error;
    }
  }

  async #assertNewValuesAvailable(user: User, dto: UpdateAccountDto): Promise<void> {
    const username = dto.username && dto.username !== user.username ? dto.username : undefined;
    const email = dto.email && dto.email !== user.email ? dto.email : undefined;

    await this.authService.assertAvailableForUpdate(user.id, username, email);
  }

  async #loadUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    return user;
  }

  async #verifyCurrentPassword(user: User, currentPassword: string): Promise<void> {
    const valid = await bcrypt.compare(currentPassword, user.passwordDigest);

    if (!valid) {
      throw new BadRequestException('Invalid current password');
    }
  }
}
