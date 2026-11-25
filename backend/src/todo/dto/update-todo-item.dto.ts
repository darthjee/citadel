import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { TODO_TEXT_MAX_LENGTH } from './todo-list-name.dto.js';
import { MaxCodePoints, NO_CONTROL_CHARACTERS, trimString } from '../../core/string-validators.js';

/**
 * Request body for `PATCH /todo/lists/:id/items/:itemId.json`: `description`
 * and/or `done`, each validated only when present (`!== undefined`), so an
 * explicit `null` answers 400 instead of reaching a NOT NULL column. The
 * "at least one field" rule lives in `TodoService#updateItem` (it accepts
 * `{ done: false }`). Taken through `@StrictBody()`, so any other field
 * answers 400.
 */
export class UpdateTodoItemDto {
  @ValidateIf((dto: UpdateTodoItemDto) => dto.description !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(TODO_TEXT_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, { message: 'description must not contain control characters' })
    description?: string;

  @ValidateIf((dto: UpdateTodoItemDto) => dto.done !== undefined)
  @IsBoolean()
    done?: boolean;
}
