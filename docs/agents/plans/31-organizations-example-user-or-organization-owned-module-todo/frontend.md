# Frontend Plan: Organizations: example user-or-organization-owned module (todo)

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on the API in [plan.md — Shared contracts](plan.md#shared-contracts), which applies in both contexts.

**Lists:**

- the index answers `[{ id, name, items_count, created_at, updated_at }]`;
- the show answers `{ id, name, created_at, updated_at, items: [{ id, description, done, created_at, updated_at }] }`;
- create and rename answer `{ id, name, created_at, updated_at }`;
- delete answers 204 (no body).

**Items:**

- create and update answer an item;
- delete answers 204.

**Errors:**

- 404 `NOT_FOUND` (uniform);
- 403 `FORBIDDEN`;
- 400 `VALIDATION_FAILED`, with `details`;
- 409 `LIST_HAS_ITEMS`.

**What you produce:**

- the UI routes `#/todo/lists`, `#/todo/lists/new`, `#/todo/lists/:id` and `#/todo/lists/:id/edit`, plus the same
  under `#/orgs/:orgId/...`;
- `ACTIONS.MANAGE_LISTS = 'manage_lists'`, with a minimum role of `admin`.

## Steps

- [01 — Client, permission, routes](frontend/01-client-routes.md)
- [02 — Pages](frontend/02-pages.md)
- [03 — Header link](frontend/03-header.md)
- [04 — Specs](frontend/04-specs.md)

## CI Checks

- `frontend`:
  - `docker-compose run --rm citadel_placeholder_fe yarn coverage` (CI job `jasmine`)
  - `docker-compose run --rm citadel_placeholder_fe yarn lint` (CI job `frontend-checks`)

## Notes

- **Follow the organizations pages from #30:**
  - each page is split into Page / Controller / Helper, with loaders as in
    `components/resources/organizations/pages/`;
  - use `useOwnerContext()` for `context`/`role`;
  - use `contextPath(context, apiPath)` for API paths and `contextHash(context, uiPath)` for links.
- **Hide controls the role can't use** (via `can()`/`useCan()`); don't disable them. If `role === null` (not loaded
  yet), render nothing for gated controls.
- **Error states:**
  - a 404 renders `NotFound`;
  - a 403 renders `PermissionDenied`. The existing `forbiddenRefreshEffect` refreshes the role.
- Write `docs/agents/modules/todo.md`'s **Frontend** section, or hand its content to the backend agent (backend step
  05).
