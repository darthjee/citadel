# Module — Todo

A live example of a **user-or-organization-owned** module: todo lists and their items, owned
either by the logged-in user (personal context) or by an organization they belong to. It
exercises the owner-context mechanism (#26–#30) end to end — `@OwnerScopedController`,
`OwnerContextGuard`, `@MinOrgRole`, `@StrictBody()`, `ownerWhere()`, the uniform 404/403 and
owner-subtree cache invalidation.

It is kept in citadel on purpose. A derived project either copies it as the template for its own
owner-scoped modules, or removes it with the [checklist](#removing-the-todo-module) below.

**Always-on** (imported directly into `AppModule`, not lazy — see
[Modular Pattern](../architecture/modular-pattern.md)). Source: `backend/src/todo/`.

## Routes

Every route exists both personally (`/todo/...`) and under `/orgs/:orgId/todo/...`
(`@OwnerScopedController('todo')`, one controller with sub-paths on its handlers). All are `.json`,
cookie-authenticated and **user-scoped** (`X-Skip-Cache: true`, `Cache-Control: private, no-store`).

| Method & path | Min role | Body | 2xx response |
|---|---|---|---|
| `GET /todo/lists.json` | any member | - | `200 [{ id, name, items_count, created_at, updated_at }]`, ordered by id |
| `POST /todo/lists.json` | `admin` | `{ name }` | `201 { id, name, created_at, updated_at }` |
| `GET /todo/lists/:id.json` | any member | - | `200 { id, name, created_at, updated_at, items: [Item] }`, items ordered by id |
| `PATCH /todo/lists/:id.json` | `admin` | `{ name }` | `200 { id, name, created_at, updated_at }` |
| `DELETE /todo/lists/:id.json` | `admin` | - | `204` (no body) |
| `POST /todo/lists/:id/items.json` | `user` | `{ description, done? }` | `201 Item` |
| `PATCH /todo/lists/:id/items/:itemId.json` | `user` | `{ description?, done? }`, at least one | `200 Item` |
| `DELETE /todo/lists/:id/items/:itemId.json` | `admin` | - | `204` (no body) |

`Item` is `{ id, description, done, created_at, updated_at }`. Responses come from hand-written
allowlist serializers (`todo/todo-response.ts`), never from entities: no response ever carries
`user_id`, `organization_id`, `list_id` or their camelCase forms. Timestamps are ISO strings. The
personal context counts as `owner`, so every route is open to the user on their own data.

### Validation

- `name` and `description`: trimmed, then required, 1–255 code points, no control characters
  (Unicode `Cc`, `NO_CONTROL_CHARACTERS` in `core/string-validators.ts`).
- `done`: a strict boolean whenever present — `"true"`, `1` and `null` answer 400. It defaults to
  `false` on create.
- Item `PATCH`: each field is validated only when present (`!== undefined`), so an explicit `null`
  answers 400. At least one field is required (`TodoService#updateItem`); `{ done: false }` alone
  is valid.
- Bodies are taken only through `@StrictBody()`: any unknown field — including `user_id`,
  `organization_id`, `list_id` and `id` — answers `400 VALIDATION_FAILED`.

### Errors and status order

| Status | Code | When |
|---|---|---|
| 404 | `NOT_FOUND` (uniform) | Unknown or malformed `:id`/`:itemId`, another owner's record, the wrong context, an item under another list, a non-member `:orgId` or a malformed `:orgId` |
| 403 | `FORBIDDEN` (uniform) | A member whose role is below the route's minimum |
| 400 | `VALIDATION_FAILED` | An invalid body or unknown fields |
| 409 | `LIST_HAS_ITEMS` | `DELETE` of a list that still has items |

The checks run in this order (documented on `TodoController`):

1. the guard answers 404 (non-member or malformed `:orgId`), then 403 (role);
2. the `@StrictBody()` pipe answers 400 (body);
3. the handler/service answers 404 (malformed id, or no such record under the owner), then 409.

None of the 403 or 400 depends on the record id, so this order leaks nothing about other owners'
records. Ids are parsed with `parseId()` (`^[1-9][0-9]*$`, up to `2147483647`) — never
`ParseIntPipe`, which would answer 400 and accept `1e3`.

## Ownership

- **A list is the owner root.** `todo_lists.user_id` and `organization_id` are **logical**
  references to `auth` (no physical FK, no relation, no cross-module JOIN). The
  `chk_todo_lists_exactly_one_owner` CHECK guarantees exactly one of them is set. On create the
  owner comes only from the request's `OwnerContext` (`{ userId, organizationId: null }` or
  `{ userId: null, organizationId }`), never from the body.
- **Every list lookup** goes through `findOne({ where: { id, ...ownerWhere(owner) } })`, which
  constrains both owner columns; a miss is the uniform 404.
- **An item inherits its owner through its list.** It has no owner columns and is only ever found
  by `{ id: itemId, listId }` **after** its list was resolved under the owner — never by `itemId`
  alone. So the uniform 404 applies one level down: another owner's item, or an item under another
  of your lists, is indistinguishable from an unknown one.
- **Counts are owner-filtered.** `items_count` is computed only over the owner's own list ids, so
  another owner's items are never counted.

## Access control

| Who | Lists | Items |
|---|---|---|
| The user, personal context (counts as `owner`) | read, create, rename, delete | read, create, update, delete |
| Organization `owner` / `admin` | read, create, rename, delete | read, create, update, delete |
| Organization `user` | read | read, create, update (not delete) |
| Non-member (including a **global admin**) | uniform 404 | uniform 404 |

There is **no global-admin bypass** anywhere in `todo/`: `User.isAdmin` grants nothing here, and a
global admin who is not a member gets the same 404 as anyone else. Roles are enforced only by
`@MinOrgRole` in `OwnerContextGuard`; `TodoService` never checks them.

## Entities

Created by `database/migrations/20261125120016-todo-create-lists-and-items.ts` (runs after
`20261107120015`; `down()` drops `todo_items`, then `todo_lists`).

| Table | Entity | Columns |
|---|---|---|
| `todo_lists` | `entities/todo-list.entity.ts` (`TodoList`) | `id`, `name` (`varchar(255)`), `user_id` (nullable), `organization_id` (nullable), `created_at`, `updated_at` |
| `todo_items` | `entities/todo-item.entity.ts` (`TodoItem`) | `id`, `list_id`, `description` (`varchar(255)`), `done` (boolean, default `false`), `created_at`, `updated_at` |

- Indexes: `idx_todo_lists_user_id`, `idx_todo_lists_organization_id`, `idx_todo_items_list_id`.
- CHECK `chk_todo_lists_exactly_one_owner`: `(user_id IS NULL) <> (organization_id IS NULL)`,
  enforced by MySQL 8.0.16+ (the project runs 9.x). TypeORM's MySQL driver silently drops
  `Table#checks` in `createTable`, so the migration adds it with a raw `ALTER TABLE`.
- `fk_todo_items_list_id`: a **real** FK (`todo_items.list_id` → `todo_lists.id`, both owned by
  `todo`) with `ON DELETE RESTRICT`.
- **409 `LIST_HAS_ITEMS`.** `TodoService#deleteList` first resolves the list under the owner (so
  another owner's non-empty list answers 404, not 409), then answers 409 when it still has items.
  An item inserted concurrently between that check and the `DELETE` makes MySQL raise the FK
  RESTRICT error (`ER_ROW_IS_REFERENCED_2`, errno 1451), which is mapped to the same 409.

Names and descriptions are user input and are **never logged**.

## Cache

- Every route is user-scoped (`X-Skip-Cache: true`), set once by `@OwnerScopedController`.
- Every successful write emits `X-Cache-Invalidate: /todo` (personal) or `/orgs/<id>/todo`
  (organization) — the owner's whole todo subtree (`InvalidatesOwner()`). Handlers declare no
  `InvalidatesPaths`/`NoCacheInvalidation` override. A 4xx emits nothing.
- Navi warms nothing: no todo route is public.
- Per-user caching (`X-Cache-Allow`) is #33.

## Out of scope

- **Per-owner caps and rate limiting.** There is no limit on the number of lists or items per
  owner, and no backend throttler exists today — nothing in `todo/` limits request rates.
- Seed data and i18n.

## Frontend

The frontend counterpart lives under `frontend/assets/js/components/resources/todo/`, served by a
`TodoClient` in the client layer.

- **Routes** (`ROUTES_CONTEXT`, so each exists personally and under `#/orgs/:orgId/...`):
  `#/todo/lists`, `#/todo/lists/new`, `#/todo/lists/:id`, `#/todo/lists/:id/edit`.
- **`SECTIONS_CONTEXT`** has a `todo` row, so switching context from a todo page lands on the
  target context's list index.
- **Header** links to the todo lists of the current context.
- **Permission** `MANAGE_LISTS` (`'manage_lists'`, minimum role `admin`), alongside `WRITE`
  (`user`) and `DELETE` (`admin`): list create/rename map to `MANAGE_LISTS`, both deletes to
  `DELETE`, item create/update to `WRITE`. The personal context resolves to `owner`, so every
  control shows.

## Removing the todo module

1. Delete `backend/src/todo/` and remove the `TodoModule` import from `backend/src/app.module.ts`.
2. The migration: on a database that never ran it, delete
   `20261125120016-todo-create-lists-and-items.ts` and its specs
   (`database/tests/todo-create-lists-and-items-migration.spec.ts`,
   `database/tests/integration/todo-create-lists-and-items.integration-spec.ts`, and its
   `MIGRATIONS`/`ENTITIES` entries in `database/tests/integration/test-data-source.ts`). On an
   already-migrated database, keep it and add a new migration dropping `todo_items` then
   `todo_lists`.
3. Remove `'TodoController'` from `KNOWN_CONTROLLERS` (`core/tests/support/route-discovery.ts`).
   Keep at least one owner-scoped controller, or re-comment the three "discovers owner-scoped …
   (> 0)" assertions in `min-org-role.coverage.spec.ts`, `owner-scoped.coverage.spec.ts` and
   `cache-invalidation.coverage.spec.ts`.
4. Remove `LIST_HAS_ITEMS` from `core/error-codes.ts`.
5. Frontend: the `todo` pages, the `ROUTES_CONTEXT` entries, the `SECTIONS_CONTEXT` row, the header
   link, `TodoClient` and `MANAGE_LISTS`.
6. This doc and the links to it (docs index, [routes](../backend/routes.md),
   [Organizations](auth/organizations.md), [Backend architecture](../architecture/backend.md),
   [Folder structure](../folder-structure.md)).
