import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Comfortably fits any real password while rejecting oversized values before they reach the
// bcrypt-adjacent compare path in `AuthorizationRequestService#authorize`.
const MAX_PASSWORD_LENGTH = 128;

/** Request body for `POST /auth/authorization-requests/:uuid/authorize.json`. */
export class AuthorizeAuthorizationRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_LENGTH)
    password!: string;
}
