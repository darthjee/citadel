import { IsNotEmpty, IsString } from 'class-validator';

/** Request body for `POST /auth/refresh.json`. */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
    refreshToken!: string;
}
