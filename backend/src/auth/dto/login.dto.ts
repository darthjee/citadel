import { IsNotEmpty, IsString } from 'class-validator';

/** Request body for `POST /auth/login.json`. */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
    username!: string;

  @IsString()
  @IsNotEmpty()
    password!: string;
}
