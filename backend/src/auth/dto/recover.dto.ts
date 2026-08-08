import { IsEmail } from 'class-validator';

/** Request body for `POST /auth/recover.json`. */
export class RecoverDto {
  @IsEmail()
    email!: string;
}
