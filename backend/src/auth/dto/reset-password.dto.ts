import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Request body for `POST /auth/reset-password.json`. `password_confirmation`,
 * sent by the frontend, is intentionally not part of this DTO — it's
 * stripped by the global `ValidationPipe`'s `whitelist: true` (same as
 * `RegisterDto` today); equality is a client-only UX check.
 */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
    token!: string;

  @IsString()
  @MinLength(8)
    password!: string;
}
