# TodoService

`backend/src/todo/todo.service.ts` owns every rule. It injects `Repository<TodoList>` and `Repository<TodoItem>`, and
receives the `OwnerContext` (or `OwnerScope`) from the controller on every call.

## Lookups (security and data-access reviews)

- **A list** is always `findOne({ where: { id, ...ownerWhere(owner) } })`. A miss throws `ownerNotFound()` from
  `core/parse-id.ts` (or the shared not-found helper the guard uses), so the body is the uniform 404.
- **An item** is always found by `{ id: itemId, listId: list.id }`, after the list has been resolved under the owner.
  - Equivalently, use a single query joining `todo_lists` under `ownerSqlWhere(owner, 'list')`, if the in-memory
    harness supports it (see step 04).
  - Never look up, update or delete by `itemId` alone.
  - A miss is the same uniform 404.
- **The owner on create** comes only from the `OwnerContext`:
  - `{ userId, organizationId: null }` for a user;
  - `{ userId: null, organizationId }` for an organization.

## Methods

- **`listLists(owner)`:**
  - fetch the lists `where: ownerWhere(owner)`, `order: { id: 'ASC' }`;
  - then count items per list, restricted to those list ids. Use `find`/`count` with `In(listIds)`, or a query
    builder that LEFT JOINs items and filters on the list alias with `ownerSqlWhere`, with bound parameters only;
  - return each list with its `itemsCount`.

  Counting only over owner-scoped list ids guarantees another owner's items are never counted.
- **`createList(owner, name)`**
- **`showList(owner, id)`:** returns the list plus its items (`where: { listId: list.id }`, `order: { id: 'ASC' }`).
- **`renameList(owner, id, name)`**
- **`deleteList(owner, id)`:**
  1. Run the owner-scoped lookup **first**, so another owner's non-empty list answers 404, not 409.
  2. If items exist, throw `new ConflictException({ code: ErrorCodes.LIST_HAS_ITEMS, message: 'List has items' })`.
  3. Delete the list.
  4. Catch a `QueryFailedError` whose driver errno is `ER_ROW_IS_REFERENCED_2` (1451), which a concurrent item insert
     can cause, and map it to the same 409. `auth/account-edit-abuse-guard.service.ts:128` shows the error-unwrapping
     pattern.
- **`createItem(owner, listId, { description, done })`:** `done` defaults to `false`.
- **`updateItem(owner, listId, itemId, changes)`:**
  - apply only the fields that are `!== undefined`;
  - if neither is present, throw `BadRequestException` with the `VALIDATION_FAILED` code (match how the DTO pipe
    reports it).
  - Do **not** reuse `auth/assert-any-field-present.ts`: its truthiness check rejects `{ done: false }`.
- **`deleteItem(owner, listId, itemId)`**

Return entities (or `{ list, itemsCount }`) to the controller; serialization happens there through the serializers
from step 03. No method checks roles: `@MinOrgRole` in the guard has already done that.

## Module

`backend/src/todo/todo.module.ts`:

- `TypeOrmModule.forFeature([TodoList, TodoItem])`;
- controllers `[TodoController]`;
- providers `[TodoService]`.

## Files to Change

- `backend/src/todo/todo.service.ts`: new.
- `backend/src/todo/todo.module.ts`: new.
