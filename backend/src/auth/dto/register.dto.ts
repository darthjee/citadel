import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/** Request body for `POST /auth/register.json`. */
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
    username!: string;

  @IsEmail()
    email!: string;

  @IsString()
  @MinLength(8)
    password!: string;
}
