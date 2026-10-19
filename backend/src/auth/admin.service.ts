import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { assertAnyFieldPresent } from './assert-any-field-present.js';
import { AuthService } from './auth.service.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { RevokedReason } from './entities/refresh-token.entity.js';
import { User, UserStatus } from './entities/user.entity.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenService } from './token.service.js';
import { UserUpdateService } from './user-update.service.js';
import { ErrorCodes } from '../core/error-codes.js';
import { MailService } from '../mail/mail.service.js';

// Message of the `422 USER_NOT_PENDING` answered when approving a user who is not `pending`.
export const USER_NOT_PENDING_MESSAGE = 'Only pending users can be approved';

// Message of the `422 CANNOT_DENY_SELF` answered when an admin tries to deny their own account.
export const CANNOT_DENY_SELF_MESSAGE = 'You cannot deny your own account';

/**
 * The admin tool's business logic: user lookup, user review (approve /
 * deny, the deny also logging the user out everywhere), and admin-triggered
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
  private readonly tokenService: TokenService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {AuthService} authService - Supplies the self-exclusion
   *   username/email availability check for `editUser`.
   * @param {PasswordResetService} passwordResetService - Mints password-reset
   *   tokens via its shared `issueToken` method.
   * @param {MailService} mailService - The Mail module's send pipe (direct DI).
   * @param {UserUpdateService} userUpdateService - Applies/hashes/persists
   *   the requested changes for `editUser`, shared with `AccountService`.
   * @param {TokenService} tokenService - Revokes every active refresh token
   *   of a user on `denyUser`.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      authService: AuthService,
      passwordResetService: PasswordResetService,
      mailService: MailService,
      userUpdateService: UserUpdateService,
      tokenService: TokenService,
  ) {
    this.userRepository = userRepository;
    this.authService = authService;
    this.passwordResetService = passwordResetService;
    this.mailService = mailService;
    this.userUpdateService = userUpdateService;
    this.tokenService = tokenService;
  }

  /**
   * Looks up accounts, optionally filtered by a search term and/or a status
   * (the two filters are ANDed).
   * @param {string} [q] - When present, matches case-insensitively against
   *   `username` or `email`; when absent, every account is returned (no
   *   pagination, per #41's scope).
   * @param {UserStatus} [status] - When present, only users with that
   *   status are returned (ANDed with each `q` branch).
   * @returns {Promise<User[]>} The matching users, `passwordDigest` included
   *   (serialization to the public shape happens in the controller).
   */
  searchUsers(q?: string, status?: UserStatus): Promise<User[]> {
    const statusFilter = status ? { status } : {};

    if (!q) {
      return status ? this.userRepository.find({ where: statusFilter }) : this.userRepository.find();
    }

    return this.userRepository.find({
      where: [
        { username: ILike(`%${q}%`), ...statusFilter },
        { email: ILike(`%${q}%`), ...statusFilter },
      ],
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

  /**
   * Approves a `pending` user through a conditional update
   * (`WHERE id = ? AND status = 'pending'`), so a concurrent deny can never
   * be overwritten. The user's sessions are untouched: an existing session
   * passes the gate on its next request.
   * @param {number} userId - The id of the user to approve.
   * @returns {Promise<User>} The user's resulting (re-read) row.
   * @throws {NotFoundException} When no user matches `userId`.
   * @throws {UnprocessableEntityException} `USER_NOT_PENDING` when the user
   *   is not (or no longer) `pending`; nothing is changed.
   */
  async approveUser(userId: number): Promise<User> {
    const user = await this.#findUserOrThrow(userId);
    const { affected } = await this.userRepository.update(
      { id: user.id, status: UserStatus.PENDING },
      { status: UserStatus.APPROVED },
    );

    if (!affected) {
      throw new UnprocessableEntityException({ code: ErrorCodes.USER_NOT_PENDING, message: USER_NOT_PENDING_MESSAGE });
    }

    return this.#findUserOrThrow(userId);
  }

  /**
   * Denies a user from any status (including `denied`, and including other
   * admins — only the caller's own account is protected), then revokes every
   * still-active refresh token of the user with `admin_denied` (already
   * revoked rows keep their reason). The status update and the bulk revoke
   * are two writes, not one transaction: once the status is `denied` the gate
   * rejects every session even if the revoke fails, and a retried deny
   * revokes what is left.
   * @param {number} userId - The id of the user to deny.
   * @param {number} callerId - The id of the calling admin (from the access token).
   * @returns {Promise<User>} The user's resulting (re-read) row.
   * @throws {NotFoundException} When no user matches `userId`.
   * @throws {UnprocessableEntityException} `CANNOT_DENY_SELF` when `userId`
   *   is the caller's own id; nothing is changed.
   */
  async denyUser(userId: number, callerId: number): Promise<User> {
    const user = await this.#findUserOrThrow(userId);

    if (user.id === callerId) {
      throw new UnprocessableEntityException({ code: ErrorCodes.CANNOT_DENY_SELF, message: CANNOT_DENY_SELF_MESSAGE });
    }

    await this.userRepository.update({ id: user.id }, { status: UserStatus.DENIED });
    await this.tokenService.revokeUserTokens(user.id, RevokedReason.ADMIN_DENIED);

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
