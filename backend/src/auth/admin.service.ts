import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { assertAnyFieldPresent } from './assert-any-field-present.js';
import { AuthService } from './auth.service.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { User } from './entities/user.entity.js';
import { PasswordResetService } from './password-reset.service.js';
import { UserUpdateService } from './user-update.service.js';
import { MailService } from '../mail/mail.service.js';

/**
 * The admin tool's business logic: user lookup, and admin-triggered
 * password-recovery-link generation/emailing — reusing `PasswordResetService
 * #issueToken` and `MailService` (from #36/#38/#39) rather than introducing
 * new machinery. Lives inside the `auth` module (not a separate `admin`
 * module) since it only ever reads/writes `User`/`PasswordResetToken`, both
 * owned by `auth` — see `docs/agents/architecture/modular-pattern.md`'s rule
 * that a module never writes to another module's tables.
 */
@Injectable()
export class AdminService {
  private readonly userRepository: Repository<User>;
  private readonly authService: AuthService;
  private readonly passwordResetService: PasswordResetService;
  private readonly mailService: MailService;
  private readonly userUpdateService: UserUpdateService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {AuthService} authService - Supplies the self-exclusion
   *   username/email availability check for `editUser`.
   * @param {PasswordResetService} passwordResetService - Mints password-reset
   *   tokens via its shared `issueToken` method.
   * @param {MailService} mailService - The Mail module's send pipe (direct DI).
   * @param {UserUpdateService} userUpdateService - Applies/hashes/persists
   *   the requested changes for `editUser`, shared with `AccountService`.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      authService: AuthService,
      passwordResetService: PasswordResetService,
      mailService: MailService,
      userUpdateService: UserUpdateService,
  ) {
    this.userRepository = userRepository;
    this.authService = authService;
    this.passwordResetService = passwordResetService;
    this.mailService = mailService;
    this.userUpdateService = userUpdateService;
  }

  /**
   * Looks up accounts, optionally filtered by a search term.
   * @param {string} [q] - When present, matches case-insensitively against
   *   `username` or `email`; when absent, every account is returned (no
   *   pagination, per #41's scope).
   * @returns {Promise<User[]>} The matching users, `passwordDigest` included
   *   (serialization to the public shape happens in the controller).
   */
  searchUsers(q?: string): Promise<User[]> {
    if (!q) {
      return this.userRepository.find();
    }

    return this.userRepository.find({
      where: [{ username: ILike(`%${q}%`) }, { email: ILike(`%${q}%`) }],
    });
  }

  /**
   * Mints a fresh password-recovery link for a user, without invalidating
   * their other outstanding tokens (matching self-service semantics).
   * @param {number} userId - The id of the user to mint a link for.
   * @returns {Promise<{ resetUrl: string }>} The freshly minted recovery URL.
   * @throws {NotFoundException} When no user matches `userId`.
   */
  async generateRecoveryLink(userId: number): Promise<{ resetUrl: string }> {
    const user = await this.#findUserOrThrow(userId);
    const { resetUrl } = await this.passwordResetService.issueToken(user);

    return { resetUrl };
  }

  /**
   * Mints a fresh password-recovery link the same way as
   * {@link generateRecoveryLink}, then sends it to the user directly and
   * synchronously (not the fire-and-forget event path self-service uses),
   * so the caller gets a real success/failure result.
   * @param {number} userId - The id of the user to send a recovery email to.
   * @returns {Promise<{ sent: boolean }>} `{ sent: true }` when the mail
   *   transport accepted the message, `{ sent: false }` when email is
   *   disabled or the send failed.
   * @throws {NotFoundException} When no user matches `userId`.
   */
  async sendRecoveryEmail(userId: number): Promise<{ sent: boolean }> {
    const user = await this.#findUserOrThrow(userId);
    const { resetUrl } = await this.passwordResetService.issueToken(user);

    try {
      const result = await this.mailService.sendEmailTemplate({
        to: user.email,
        template: 'password-recovery',
        variables: { resetUrl },
      });

      return { sent: result.status === 'sent' };
    } catch {
      return { sent: false };
    }
  }

  /**
   * Updates a target user's username, email, and/or password on the
   * admin's behalf — no current-password confirmation, unlike
   * `AccountService#updateAccount`'s self-service flow, since the admin is
   * confirming their own already-authenticated session, not the target
   * user's credentials. Works identically when `userId` is the calling
   * admin's own id — no special-casing needed, since there is no
   * current-password check to skip in the first place.
   * @param {number} userId - The id of the user to update.
   * @param {AdminUpdateUserDto} dto - The requested changes.
   * @returns {Promise<User>} The user's resulting row.
   * @throws {BadRequestException} When no field is being changed.
   * @throws {ConflictException} When the new username/email is already taken.
   * @throws {NotFoundException} When no user matches `userId`.
   */
  async editUser(userId: number, dto: AdminUpdateUserDto): Promise<User> {
    assertAnyFieldPresent(dto);

    const user = await this.#findUserOrThrow(userId);
    const username = dto.username && dto.username !== user.username ? dto.username : undefined;
    const email = dto.email && dto.email !== user.email ? dto.email : undefined;

    await this.authService.assertAvailableForUpdate(user.id, username, email);
    await this.userUpdateService.applyUserUpdate(user, dto);

    return this.#findUserOrThrow(userId);
  }

  async #findUserOrThrow(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
