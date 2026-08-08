import { IsOptional, IsString } from 'class-validator';

/** Request body for `POST /admin/users/search.json`. */
export class SearchUsersDto {
  @IsOptional()
  @IsString()
    q?: string;
}
