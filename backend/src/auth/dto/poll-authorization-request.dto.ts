import { IsNotEmpty, IsString } from 'class-validator';

/** Request body for `POST /auth/authorization-requests/:uuid/poll.json`. */
export class PollAuthorizationRequestDto {
  @IsString()
  @IsNotEmpty()
    pollToken!: string;
}
