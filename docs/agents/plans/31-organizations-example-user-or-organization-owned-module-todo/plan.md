# Plan: Organizations: example user-or-organization-owned module (todo)

Issue: [31-organizations-example-user-or-organization-owned-module-todo.md](../../issues/31-organizations-example-user-or-organization-owned-module-todo.md)

## Overview

Build a live `todo` example module (lists and items) owned by either the user or an organization. It exercises the
owner-context mechanism from #26–#30 end to end:

- **backend:** migration, entities, service, controller, DTOs and serializers; the ported role-matrix e2e tests; the
  restored coverage assertions;
- **frontend:** client, routes, pages, header link and the `MANAGE_LISTS` permission;
- **docs:** `docs/agents/modules/todo.md`, with a removal checklist.

The security, data-access and cache reviews ran at planning time. Their requirements are folded into the steps
below and summarized in [Review findings](#review-findings).

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

The `cache` agent has no work: all routes are user-scoped, so Navi warms nothing and `navi/` is unchanged.

## Shared contracts

### Routes

Every route exists both personally (`/todo/...`) and under `/orgs/:orgId/todo/...`. All are `.json`, cookie-auth,
user-scoped (`X-Skip-Cache: true`).

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

`Item` is `{ id, description, done, created_at, updated_at }`. No response ever carries `user_id`,
`organization_id`, `list_id` or their camelCase forms. Timestamps are ISO strings.

### Errors

The standard error body is `{ error: { code, message, details? }, statusCode, timestamp }`.

- **404 `NOT_FOUND` (uniform):** an unknown or malformed id, another owner's record, the wrong context, an item under
  another list, a non-member `:orgId`, or a malformed `:orgId`.
- **403 `FORBIDDEN` (uniform):** a member whose role is below the route's minimum.
- **400 `VALIDATION_FAILED`:** an invalid body or unknown fields, including `user_id`, `organization_id`, `list_id`
  or `id`.
- **409 `LIST_HAS_ITEMS`:** `DELETE` of a list that still has items.

### Validation

- `name` and `description`: trimmed, required, 1–255 code points, no control characters (Unicode Cc).
- `done`: a strict boolean.

### Frontend permission

`MANAGE_LISTS` (`'manage_lists'`), minimum role `admin`. It sits alongside `WRITE` (`user`) and `DELETE` (`admin`).

- Personal context resolves to `owner`, so every control shows.
- `POST` and `PATCH` on lists map to `MANAGE_LISTS`.
- Both `DELETE`s map to `DELETE`.
- Item `POST` and `PATCH` map to `WRITE`.

### UI routes

- `#/todo/lists`
- `#/todo/lists/new`
- `#/todo/lists/:id`
- `#/todo/lists/:id/edit`
- the same four under `#/orgs/:orgId/...`

## Review findings

- **Security:**
  - Strict id parsing for `:id` and `:itemId`; never use `ParseIntPipe`.
  - An item is only found by `item.id` + `list_id` within the owner-scoped list.
  - `items_count` is owner-filtered, with bound parameters.
  - Item PATCH presence check uses `!== undefined`; reject `null`; `done` is a strict boolean.
  - Map the FK RESTRICT error from the delete race to 409.
  - No global-admin bypass.
  - Never log names or descriptions.
  - Per-owner caps and rate limits are out of scope and documented as such.
- **Data-access:**
  - Hand-written allowlist serializers, never entities.
  - Owner set only from `OwnerContext`.
  - The 409 check runs only after the owner-scoped lookup, so another owner's non-empty list answers 404, not 409.
  - `ownerKeysIn` runs on every 2xx response, and serializer specs assert exact key sets.
- **Cache:**
  - One controller `@OwnerScopedController('todo')`, with sub-paths on the handlers. Its emitted invalidation base is
    `/todo` or `/orgs/<id>/todo`, which covers every todo path.
  - No `InvalidatesPaths`/`NoCacheInvalidation` overrides.
  - Navi is unchanged.
  - Restore the three "> 0" assertions.

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn coverage` and `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI jobs `backend_tests`, `backend_checks`)
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn coverage` and `docker-compose run --rm citadel_placeholder_fe yarn lint` (CI jobs `jasmine`, `frontend-checks`)

## Notes

- Never run `npm`, `yarn` or `node` on the host. Always go through `docker-compose`.
- Backend controllers stay thin: every rule lives in `TodoService`.
