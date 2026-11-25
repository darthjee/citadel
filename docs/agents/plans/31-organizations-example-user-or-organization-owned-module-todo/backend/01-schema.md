# Schema: migration, entities, error code

Create the two tables and their entities, and add the specific 409 error code.

## Migration

Add `backend/src/database/migrations/<timestamp>-todo-create-lists-and-items.ts`, with a timestamp after
`20261107120015`. Use the helpers in `database/migrations/helpers.ts` (`idColumn`, `createdAtColumn`,
`updatedAtColumn`), and declare indexes and FKs inside `createTable`, as
`20261107120015-auth-create-organizations.ts` does.

**`todo_lists`:**

- `id`;
- `name` varchar(255);
- `user_id` int, nullable;
- `organization_id` int, nullable;
- `created_at`, `updated_at`.

Indexes `idx_todo_lists_user_id` and `idx_todo_lists_organization_id`.

**No FKs** on the owner columns: they are logical references, because they cross modules (`todo` → `auth`). Say so in
the migration's doc comment.

Add a CHECK constraint `chk_todo_lists_exactly_one_owner`:
`(user_id IS NULL) <> (organization_id IS NULL)`. Use `TableCheck` in `checks:`. MySQL 8.0.16+ enforces it; confirm
the version in `docker-compose.yml`.

**`todo_items`:**

- `id`;
- `list_id` int, not null;
- `description` varchar(255);
- `done` boolean, not null, default false;
- `created_at`, `updated_at`.

Index `idx_todo_items_list_id`. A **real** FK `fk_todo_items_list_id` → `todo_lists(id)` with `onDelete: 'RESTRICT'`.
There are no owner columns: items inherit the owner through their list.

`down()` drops `todo_items`, then `todo_lists`.

## Entities

`backend/src/todo/entities/todo-list.entity.ts`, `TodoList`:

- `id`, `name`;
- `userId: number | null`, `organizationId: number | null`, using `name: 'user_id'` / `'organization_id'`;
- `createdAt`, `updatedAt`.

Follow `auth/entities/organization.entity.ts` for column and timestamp decorators. Do not add relations to `auth`
entities.

`backend/src/todo/entities/todo-item.entity.ts`, `TodoItem`:

- `id`, `listId` (`list_id`), `description`, `done`, `createdAt`, `updatedAt`;
- optionally `@ManyToOne(() => TodoList, { onDelete: 'RESTRICT' })` with `@JoinColumn({ name: 'list_id' })`, if it
  simplifies the join. Keep `listId` as a plain column too.

Entities load through `autoLoadEntities` (app) and `dist/**/*.entity.js` (data source), so no registration list
needs editing.

## Error code

Add `LIST_HAS_ITEMS: 'LIST_HAS_ITEMS'` to `ErrorCodes` in `backend/src/core/error-codes.ts`. 409 already maps to the
`CONFLICT` category.

## Shared validator

Move `NO_CONTROL_CHARACTERS` from `auth/dto/organization-name.dto.ts` into `core/string-validators.ts` as an export.
Re-import it in `OrganizationNameDto`, so the todo DTOs reuse it rather than copy it. Behaviour is unchanged; extend
`string-validators.spec.ts` if it tests exports.

## Files to Change

- `backend/src/database/migrations/<timestamp>-todo-create-lists-and-items.ts`: new.
- `backend/src/todo/entities/todo-list.entity.ts`: new.
- `backend/src/todo/entities/todo-item.entity.ts`: new.
- `backend/src/core/error-codes.ts`: add `LIST_HAS_ITEMS`.
- `backend/src/core/string-validators.ts`: export `NO_CONTROL_CHARACTERS`.
- `backend/src/auth/dto/organization-name.dto.ts`: import it instead of defining it.
- `backend/src/database/tests/*`: extend the migration-listing spec, if one enumerates the migrations.
