import { UserFieldChangesDto } from './user-field-changes.dto.js';

/**
 * Request body for `POST admin/users/:id/edit.json`. At least one of
 * `username`, `email`, or `newPassword` must be present — that rule is
 * business logic enforced by `AdminService`, not a per-field decorator
 * here, mirroring `UpdateAccountDto`. No `currentPassword` (the admin
 * confirms their own session, not the target user's password) and no
 * `newPasswordConfirmation` field (password confirmation equality is a
 * client-only UX check). `isAdmin` is deliberately absent — it stays
 * read-only from this endpoint.
 */
export class AdminUpdateUserDto extends UserFieldChangesDto {}
