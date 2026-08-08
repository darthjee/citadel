import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Shared field block for `UpdateAccountDto` and `AdminUpdateUserDto` — the
 * updatable user fields both self-service account updates and admin user
 * edits accept. Also the type `assertAnyFieldPresent` validates against, so
 * a future reader doesn't need to chase both subclasses to understand why
 * it exists.
 */
export class UserFieldChangesDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
    username?: string;

  @IsOptional()
  @IsEmail()
    email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
    newPassword?: string;
}
