import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { SearchUsersDto } from './dto/search-users.dto.js';
import { User } from './entities/user.entity.js';
import { AdminOnly } from '../core/admin-only.decorator.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';

/**
 * Admin-only routes for #41's user-lookup/password-recovery tool — thin,
 * delegating all business logic to `AdminService`. Every route requires the
 * default `JwtGuard` behavior (no `@Public()`) plus `@AdminOnly()`, applied
 * once at the controller level since every route here needs it. `@CachePolicy(CacheClass.Never)`
 * is likewise applied once at the controller level since every route's
 * response carries per-request secrets/PII that must never be cross-served
 * between callers by Tent's `default_proxy` caching rule.
 */
@Controller('admin')
@AdminOnly()
@CachePolicy(CacheClass.Never)
export class AdminController {
  private readonly adminService: AdminService;

  /**
   * @param {AdminService} adminService - The admin tool's business logic.
   */
  constructor(adminService: AdminService) {
    this.adminService = adminService;
  }

  /**
   * `POST /admin/users/:id/edit.json`. Updates a target user's username,
   * email, and/or password on the admin's behalf.
   * @param {number} id - The id of the user to update.
   * @param {AdminUpdateUserDto} dto - The requested changes.
   * @returns {Promise<object>} `{ user: { id, username, email, isAdmin, createdAt } }`.
   */
  @Post('users/:id/edit.json')
  async edit(
    @Param('id', ParseIntPipe) id: number,
      @Body() dto: AdminUpdateUserDto,
  ): Promise<object> {
    const user = await this.adminService.editUser(id, dto);

    return { user: this.#serializeUser(user) };
  }

  /**
   * `POST /admin/users/:id/recovery-link.json`. Always mints a fresh
   * password-recovery token (never invalidates the user's other
   * outstanding tokens).
   * @param {number} id - The id of the user to mint a link for.
   * @returns {Promise<object>} `{ resetUrl }`.
   */
  @Post('users/:id/recovery-link.json')
  async recoveryLink(@Param('id', ParseIntPipe) id: number): Promise<object> {
    return this.adminService.generateRecoveryLink(id);
  }

  /**
   * `POST /admin/users/search.json`. Looks up accounts, optionally filtered
   * by `dto.q`.
   * @param {SearchUsersDto} dto - Carries the optional search term.
   * @returns {Promise<object>} `{ users: [{ id, username, email, isAdmin, createdAt }] }`.
   */
  @Post('users/search.json')
  async search(@Body() dto: SearchUsersDto): Promise<object> {
    const users = await this.adminService.searchUsers(dto.q);

    return { users: users.map((user) => this.#serializeUser(user)) };
  }

  /**
   * `POST /admin/users/:id/send-recovery-email.json`. Mints a fresh
   * password-recovery token the same way as `recoveryLink`, then sends it
   * directly and synchronously so the caller gets a real success/failure
   * result.
   * @param {number} id - The id of the user to send a recovery email to.
   * @returns {Promise<object>} `{ sent }`.
   */
  @Post('users/:id/send-recovery-email.json')
  async sendRecoveryEmail(@Param('id', ParseIntPipe) id: number): Promise<object> {
    return this.adminService.sendRecoveryEmail(id);
  }

  #serializeUser(user: User): object {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };
  }
}
