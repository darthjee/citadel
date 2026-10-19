import { IsIn, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../entities/user.entity.js';

/** Request body for `POST /admin/users/search.json`. */
export class SearchUsersDto {
  @IsOptional()
  @IsString()
    q?: string;

  @IsOptional()
  @IsIn(Object.values(UserStatus))
    status?: UserStatus;
}
