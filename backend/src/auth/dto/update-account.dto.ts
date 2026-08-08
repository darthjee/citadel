import { IsNotEmpty, IsString } from 'class-validator';
import { UserFieldChangesDto } from './user-field-changes.dto.js';

/**
 * Request body for `PATCH /auth/account.json`. At least one of `username`,
 * `email`, or `newPassword` must be present — that rule is business logic
 * enforced by `AccountService`, not a per-field decorator here. No
 * `newPasswordConfirmation` field — matching `RegisterDto`/`ResetPasswordDto`,
 * password confirmation equality is a client-only UX check.
 */
export class UpdateAccountDto extends UserFieldChangesDto {
  @IsString()
  @IsNotEmpty()
    currentPassword!: string;
}
