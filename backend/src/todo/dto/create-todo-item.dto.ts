import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { TODO_TEXT_MAX_LENGTH } from './todo-list-name.dto.js';
import { MaxCodePoints, NO_CONTROL_CHARACTERS, trimString } from '../../core/string-validators.js';

/**
 * Request body for `POST /todo/lists/:id/items.json`: a required
 * `description` (trimmed, non-empty, at most {@link TODO_TEXT_MAX_LENGTH} code
 * points, no control characters) and an optional strict-boolean `done`
 * (validated whenever present, so `null`, `"true"` or `1` answer 400; it
 * defaults to `false`). Taken through
 * `@StrictBody()`, so any other field (e.g. `list_id`, `id`) answers 400.
 */
export class CreateTodoItemDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(TODO_TEXT_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, { message: 'description must not contain control characters' })
    description!: string;

  @ValidateIf((dto: CreateTodoItemDto) => dto.done !== undefined)
  @IsBoolean()
    done?: boolean;
}
