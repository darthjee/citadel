# Routes — Todo

Todo list and item routes, served by `TodoController` (`todo/todo.controller.ts`), mounted twice by
`@OwnerScopedController('todo')`: under `/todo` (personal context) and under `/orgs/:orgId/todo`
(organization context). Every route requires the default `JwtGuard` (no `@Public()`); the global
`OwnerContextGuard` resolves the owner and enforces `@MinOrgRole`. The controller is thin; business
logic lives in `TodoService` (`todo/todo.service.ts`). Module spec: [Todo](../../modules/todo.md).

Every route is user-scoped (`X-Skip-Cache: true`); every successful write emits
`X-Cache-Invalidate: /todo` or `/orgs/<id>/todo`.

## Items

```json
{ "id": 3, "name": "Groceries", "created_at": "2026-11-25T12:00:00.000Z", "updated_at": "2026-11-25T12:00:00.000Z" }
```

A list carries `items_count` in the index and `items` (an array of items) on show. An item is
`{ id, description, done, created_at, updated_at }`. Never `user_id`, `organization_id` or `list_id`.

## Endpoints

The paths below are the personal ones; each also exists under `/orgs/:orgId`.

| Method & path | Min role | Body | Success | Errors |
|---|---|---|---|---|
| `GET /todo/lists.json` | any member | - | `200` lists with `items_count`, ordered by id | `404` |
| `POST /todo/lists.json` | `admin` | `TodoListNameDto` `{ name }` | `201` list | `400`, `403`, `404` |
| `GET /todo/lists/:id.json` | any member | - | `200` list with `items`, ordered by id | `404` |
| `PATCH /todo/lists/:id.json` | `admin` | `TodoListNameDto` `{ name }` | `200` list | `400`, `403`, `404` |
| `DELETE /todo/lists/:id.json` | `admin` | - | `204` | `403`, `404`, `409 LIST_HAS_ITEMS` |
| `POST /todo/lists/:id/items.json` | `user` | `CreateTodoItemDto` `{ description, done? }` | `201` item | `400`, `403`, `404` |
| `PATCH /todo/lists/:id/items/:itemId.json` | `user` | `UpdateTodoItemDto` `{ description?, done? }`, at least one | `200` item | `400`, `403`, `404` |
| `DELETE /todo/lists/:id/items/:itemId.json` | `admin` | - | `204` | `403`, `404` |

`404` is the uniform owner-scoped body (unknown, malformed, foreign or wrong-context ids, non-member
or malformed `:orgId`, global admins included); `403` is the uniform role body. Status order: guard
`404` → guard `403` → body `400` → record `404` → `409`.
