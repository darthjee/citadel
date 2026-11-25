# Backend Plan: Organizations: example user-or-organization-owned module (todo)

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the API in [plan.md — Shared contracts](plan.md#shared-contracts):

- every route, method, minimum role, body and response shape;
- the uniform 404/403;
- 400 `VALIDATION_FAILED`;
- 409 `LIST_HAS_ITEMS`;
- `204` with no body on both `DELETE`s.

The frontend relies on exactly these field names, in snake_case:

- **list:** `id`, `name`, `items_count` (index only), `items` (show only), `created_at`, `updated_at`;
- **item:** `id`, `description`, `done`, `created_at`, `updated_at`.

## Steps

- [01 — Schema: migration, entities, error code](backend/01-schema.md)
- [02 — TodoService](backend/02-service.md)
- [03 — DTOs, serializers, controller, module wiring](backend/03-controller.md)
- [04 — Tests: unit specs, role matrix, coverage specs](backend/04-tests.md)
- [05 — Docs and code_sample cleanup](backend/05-docs.md)

## CI Checks

- `backend`:
  - `docker-compose run --rm citadel_placeholder_tests yarn coverage` (CI job `backend_tests`)
  - `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI job `backend_checks`)

## Notes

- Keep `TodoController` thin: owner resolution, scoping, the 404s, the 409 and the presence rule all live in
  `TodoService`.
- Use one controller, `@OwnerScopedController('todo')`, with sub-paths on the handlers (`lists.json`,
  `lists/:id/items/:itemId.json`, ...).
  - Do **not** add a separate items controller mounted at `todo/lists/:id/items`. Its invalidation base would contain
    a literal `:id` (cache review).
  - Do not add `InvalidatesOwner`, `InvalidatesPaths` or `NoCacheInvalidation` on the handlers.
- No `isAdmin` bypass anywhere in `todo/`. A global admin is treated like any other non-member.
- Never log list names or item descriptions.
- The status order is documented on the controller, the way `organization.controller.ts` documents its own:
  1. the guard answers 404 (non-member or malformed `:orgId`), then 403 (role);
  2. the pipe answers 400 (body);
  3. the service answers 404 (record), then 409.

  None of the 403 or 400 depends on the id, so this order leaks nothing.
