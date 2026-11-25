import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { MaxCodePoints, NO_CONTROL_CHARACTERS, trimString } from '../../core/string-validators.js';

export { MaxCodePoints, trimString } from '../../core/string-validators.js';

/** Longest accepted organization name, in code points (matches `varchar(255)`). */
export const ORGANIZATION_NAME_MAX_LENGTH = 255;

/**
 * Request body for `POST /orgs.json` and `PATCH /orgs/:orgId.json`: only `name`,
 * required in both. The name is trimmed, then must be non-empty, at most
 * {@link ORGANIZATION_NAME_MAX_LENGTH} code points and free of control
 * characters. Taken through `@StrictBody()`, so any other field (e.g. `role`,
 * `organizationId`) answers 400.
 */
export class OrganizationNameDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(ORGANIZATION_NAME_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, { message: 'name must not contain control characters' })
    name!: string;
}
