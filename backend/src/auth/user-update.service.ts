import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

/** The `{username, email}` shape returned to the caller after an account update. */
export interface AccountSummary {
  username: string;
  email: string;
}

/**
 * Applies and persists `username`/`email`/password changes to an
 * already-loaded user row. Split out from `AuthService` (which already
 * handles the availability check via `assertAvailableForUpdate`) rather
 * than growing that file past the project's 300-line-per-file convention.
 * Shared by `AccountService#updateAccount` (self-service, confirmed by the
 * caller's current password) and `AdminService#editUser` (admin-driven,
 * no current-password confirmation) — both validate availability
 * beforehand via `AuthService#assertAvailableForUpdate` and differ only in
 * how the target user and permission are established. Only the edited
 * columns are ever written (never `status`), so a concurrent approve/deny
 * cannot be reverted by an in-flight edit.
 */
@Injectable()
export class UserUpdateService {
  private readonly userRepository: Repository<User>;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   */
  constructor(@InjectRepository(User) userRepository: Repository<User>) {
    this.userRepository = userRepository;
  }

  /**
   * Applies a set of account changes to a user: mutates the provided
   * `username`/`email` fields on the in-memory row, hashes a new password
   * when given, and persists **only those changed columns** through
   * `Repository#update(id, changes)`. It deliberately never calls
   * `save(user)`: that would write back every loaded column, `status`
   * included, so a deny (or approve) committing between the caller's load
   * and this persist would be silently reverted by the stale in-memory
   * status. Columns the edit doesn't own (`status`, `isAdmin`, ...) are
   * therefore never written. When no field changes, nothing is persisted.
   * @param {User} user - The user row to update (already loaded by the caller).
   * @param {object} changes - The fields to change.
   * @param {string} [changes.username] - The new username, when being changed.
   * @param {string} [changes.email] - The new email, when being changed.
   * @param {string} [changes.newPassword] - The new plaintext password, when being changed.
   * @returns {Promise<AccountSummary>} The user's resulting username and email.
   */
  async applyUserUpdate(
    user: User,
    changes: { username?: string; email?: string; newPassword?: string },
  ): Promise<AccountSummary> {
    const columns = await this.#changedColumns(changes);

    if (Object.keys(columns).length > 0) {
      await this.userRepository.update(user.id, columns);
      Object.assign(user, columns);
    }

    return { username: user.username, email: user.email };
  }

  async #changedColumns(
    changes: { username?: string; email?: string; newPassword?: string },
  ): Promise<Partial<Pick<User, 'username' | 'email' | 'passwordDigest'>>> {
    const columns: Partial<Pick<User, 'username' | 'email' | 'passwordDigest'>> = {};

    if (changes.username) {
      columns.username = changes.username;
    }

    if (changes.email) {
      columns.email = changes.email;
    }

    if (changes.newPassword) {
      columns.passwordDigest = await bcrypt.hash(changes.newPassword, 10);
    }

    return columns;
  }
}
