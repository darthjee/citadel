import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { MaxCodePoints, NO_CONTROL_CHARACTERS, trimString } from '../../core/string-validators.js';

/** Longest accepted list name or item description, in code points (matches `varchar(255)`). */
export const TODO_TEXT_MAX_LENGTH = 255;

/**
 * Request body for `POST /todo/lists.json` and `PATCH /todo/lists/:id.json`:
 * only `name`, required in both. The name is trimmed, then must be non-empty,
 * at most {@link TODO_TEXT_MAX_LENGTH} code points and free of control
 * characters. Taken through `@StrictBody()`, so any other field (e.g.
 * `user_id`, `organization_id`, `id`) answers 400.
 */
export class TodoListNameDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(TODO_TEXT_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, { message: 'name must not contain control characters' })
    name!: string;
}
