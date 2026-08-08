import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Comfortably fits any real username (matches `User#username`'s default `varchar(255)` column)
// while rejecting oversized values before they ever reach `create`'s DB/rate-limit checks.
const MAX_USERNAME_LENGTH = 255;

/** Request body for `POST /auth/authorization-requests.json`. */
export class CreateAuthorizationRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_USERNAME_LENGTH)
    username!: string;
}
