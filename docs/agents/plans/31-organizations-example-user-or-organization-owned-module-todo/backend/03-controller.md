# DTOs, serializers, controller, module wiring

## DTOs (`backend/src/todo/dto/`)

**`todo-list-name.dto.ts`, `TodoListNameDto`:** `name`, with the same decorators as `OrganizationNameDto`:

- `@Transform(trimString)`, `@IsString()`, `@IsNotEmpty()`;
- `@MaxCodePoints(255)`;
- `@Matches(NO_CONTROL_CHARACTERS, ...)`.

**`create-todo-item.dto.ts`:**

- `description`: the same rules as `name`;
- `done?`: `@IsOptional()` plus `@IsBoolean()`, with no implicit conversion, so `"true"` and `1` answer 400.

**`update-todo-item.dto.ts`:**

- `description?`: `@ValidateIf((o) => o.description !== undefined)` plus the `name` rules, so `null` answers 400
  instead of reaching the NOT NULL column;
- `done?`: `@ValidateIf((o) => o.done !== undefined)` plus `@IsBoolean()`, so `null` answers 400.

Every body goes through `@StrictBody()`. Unknown keys, including `user_id`, `organization_id`, `list_id` and `id`,
answer 400.

## Serializers (`backend/src/todo/todo-response.ts`)

Hand-written allowlists, like `auth/organization-response.ts`. Never spread an entity and never return one.

- `serializeTodoList(list)` returns `{ id, name, created_at, updated_at }`.
- `serializeTodoListSummary(list, itemsCount)` returns `{ id, name, items_count, created_at, updated_at }`.
- `serializeTodoListDetail(list, items)` returns `{ id, name, created_at, updated_at, items: items.map(serializeTodoItem) }`.
- `serializeTodoItem(item)` returns `{ id, description, done, created_at, updated_at }`, with no `list_id`.

## Id parsing

`core/parse-id.ts` exports `parseId()` and `ownerNotFound()`; there is no pipe.

- Take `:id` and `:itemId` as raw strings and call `parseId()` on each, as `organization.controller.ts` does with
  `parseOrgId`. Alternatively, add a tiny `ParseIdPipe` in `core/` that wraps `parseId()`, with a spec.
- Never use `ParseIntPipe`: it answers 400 and accepts `1e3`.
- A malformed id answers the uniform 404.

## Controller (`backend/src/todo/todo.controller.ts`)

`@OwnerScopedController('todo')`, with `TodoService` injected. Each handler only parses ids, calls one service
method and serializes the result.

| Handler | Decorators |
|---|---|
| `@Get('lists.json')` | none |
| `@Post('lists.json')` | `@MinOrgRole(OrgRole.ADMIN)` |
| `@Get('lists/:id.json')` | none |
| `@Patch('lists/:id.json')` | `@MinOrgRole(OrgRole.ADMIN)` |
| `@Delete('lists/:id.json')` | `@MinOrgRole(OrgRole.ADMIN)` and `@HttpCode(HttpStatus.NO_CONTENT)` |
| `@Post('lists/:id/items.json')` | `@MinOrgRole(OrgRole.USER)` |
| `@Patch('lists/:id/items/:itemId.json')` | `@MinOrgRole(OrgRole.USER)` |
| `@Delete('lists/:id/items/:itemId.json')` | `@MinOrgRole(OrgRole.ADMIN)` and `@HttpCode(HttpStatus.NO_CONTENT)` |

- Handlers read the owner through `@CurrentOwner()` and bodies through `@StrictBody()`.
- Check route ordering: `lists.json` vs `lists/:id.json`. Nest matches `lists.json` literally first only if it is
  declared first; confirm with an e2e test that `GET /todo/lists.json` hits the index.
- The class doc comment documents the status order (see [backend.md](../backend.md) Notes).

## Wiring

- `app.module.ts`: import `TodoModule`, always on (not lazy). Update the module doc comment.
- `core/tests/support/route-discovery.ts`: add `'TodoController'` to `KNOWN_CONTROLLERS`.

## Files to Change

- `backend/src/todo/dto/todo-list-name.dto.ts`: new.
- `backend/src/todo/dto/create-todo-item.dto.ts`: new.
- `backend/src/todo/dto/update-todo-item.dto.ts`: new.
- `backend/src/todo/todo-response.ts`: new.
- `backend/src/todo/todo.controller.ts`: new.
- `backend/src/app.module.ts`: import `TodoModule`.
- `backend/src/core/tests/support/route-discovery.ts`: add `TodoController`.
