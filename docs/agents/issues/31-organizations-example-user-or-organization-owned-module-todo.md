# Issue: Organizations: example user-or-organization-owned module (todo)

## Description

Part of epic #25 (Organizations: optional org ownership for domain data). Citadel is a project template; organizations
ship with it so derived projects can have domain data owned by an organization instead of a single user. The target
behaviour is specified in `docs/agents/specs/orgs/` (hub: `README.md`), and the original implementation is mirrored
under `docs/agents/specs/orgs/code_sample/`, with the same paths as in the real codebase.

**Approach (applies to every sub-issue):** move the files from `code_sample/` into their real location, then adapt
them to citadel. Stay close to the original so fixes can flow between citadel and its derived projects. Remove each
`code_sample/` file once it has been moved/reconciled, and fold what matters into the permanent docs.

**Depends on:** #26–#30 (merged).

## Problem

#26–#30 shipped the owner-context mechanism (guard, `@OwnerScopedController`, `@MinOrgRole`, `@CurrentOwner`,
`ownerWhere`, cache invalidation), the organizations backend and the frontend context switcher, but citadel has no
domain module that uses them. Without one:

- nothing shows a derived project how to build a user-or-organization-owned module end to end;
- `ROUTES_CONTEXT` and `SECTIONS_CONTEXT` in `frontend/assets/js/utils/routing/routes.js` are empty;
- the three coverage specs had to drop their "discovers owner-scoped routes (> 0)" assertions;
- the sample's `bank/tests/org-roles.e2e-spec.ts` and `bank/tests/support/owner-matrix.ts` have nothing to test.

## Expected Behavior

A small, live `todo` module, owned by either the user or an organization, built end to end (backend, frontend,
tests, docs) in this issue. Its permanent doc (`docs/agents/modules/todo.md`) is the spec; no follow-up
implementation issue is opened.

### Domain

- A **list** (`name`) is the owner root; an **item** (`description`, `done`) belongs to a list and inherits the owner
  through it.
- Full CRUD on both.

### Routes and minimum roles

Each route exists personally (`/todo/...`) and under `/orgs/:orgId/todo/...`. Ward's rule applies: everyday data
entry is `user`; anything structural or destructive is `admin`; nothing is owner-only. A new frontend permission
`MANAGE_LISTS` (`admin`) mirrors ward's `MANAGE_ACCOUNTS`.

| Route | Min role | Frontend permission |
|---|---|---|
| `GET /todo/lists.json` | any member | - |
| `POST /todo/lists.json` | `admin` | `MANAGE_LISTS` |
| `GET /todo/lists/:id.json` (list + its items) | any member | - |
| `PATCH /todo/lists/:id.json` (rename) | `admin` | `MANAGE_LISTS` |
| `DELETE /todo/lists/:id.json` (409 while it has items) | `admin` | `DELETE` |
| `POST /todo/lists/:id/items.json` | `user` | `WRITE` |
| `PATCH /todo/lists/:id/items/:itemId.json` (description, done) | `user` | `WRITE` |
| `DELETE /todo/lists/:id/items/:itemId.json` | `admin` | `DELETE` |

### Behaviour

- **Uniform 404:** an unknown id, a record of another owner, and a record in the wrong context (an organization list
  on a personal route, or the reverse) answer the same 404. This holds one level down: an item is only ever looked up
  through its list, so an item id under a different list answers the same 404.
- **Deleting a list with items** is refused with 409 and a specific code (`LIST_HAS_ITEMS`), following ward's
  `ACCOUNT_HAS_TRANSACTIONS` precedent and its fail-closed posture. The user deletes the items first.
- **Validation:** list `name` and item `description` are trimmed, required, 1–255 code points, no control characters
  (same rules as `OrganizationNameDto`); `done` is a boolean. Bodies go through `@StrictBody()`, so unknown fields,
  including owner fields, answer 400. The item PATCH accepts `description` and/or `done` and needs at least one of
  them (a new rule; ward's organization PATCH is single-field).
- **Responses** come from hand-written serializers, never entities, and never include owner fields:
  - a list is `{ id, name, created_at, updated_at }`;
  - the index adds `items_count`;
  - the show adds `items: [{ id, description, done, created_at, updated_at }]`, ordered by id.
  Nothing is paginated; lists are ordered by id.

## Solution

### Backend

- **Module** `backend/src/todo/`, always on, registered in `AppModule` (not lazy-loaded).
- **Migration and entities:**
  - `todo_lists`: `id`, `name` varchar(255), nullable indexed **logical** `user_id` / `organization_id` (no FK,
    since they cross modules) with a DB CHECK that exactly one is set, and timestamps.
  - `todo_items`: `id`, `list_id` as a **real FK** to `todo_lists` with `ON DELETE RESTRICT`, `description`
    varchar(255), `done` boolean (default false), and timestamps. No owner columns: items inherit the owner through
    the list and never store a copy.
- **Service:** owns every rule (controllers stay thin).
  - Every list query goes through `ownerWhere()` / `ownerSqlWhere()`.
  - Every item query joins its list under the same owner filter, including the `items_count` aggregate, so it can
    never count or reach another owner's items.
  - The list delete checks for items and throws a 409 with `LIST_HAS_ITEMS`, a new specific code in
    `core/error-codes.ts`.
- **Controllers:** `@OwnerScopedController('todo')` with `@MinOrgRole` on every write, `@CurrentOwner()`,
  `@StrictBody()` and `ParseIdPipe`.
  - Mounting at `todo` (not `todo/lists`) keeps `InvalidatesOwner()`'s emitted base (`/todo` or `/orgs/<id>/todo`)
    covering both list and item paths. Planning confirms the emitted path matches the real prefixes.
  - `InvalidatesOwner()` is already applied by `@OwnerScopedController`; handlers do not repeat it.

### Cache

- The routes are user-scoped (`private, no-store`, `X-Skip-Cache`), so Tent caches nothing.
- Writes emit `X-Cache-Invalidate` for the owner's `/todo` subtree.
- Navi warms nothing, since only public routes are warmable.
- Per-user caching stays in #33.

### Frontend

- **Pages:**
  - `/todo/lists` (index);
  - `/todo/lists/new`;
  - `/todo/lists/:id` (show, with items managed inline: add, edit, toggle `done`, delete);
  - `/todo/lists/:id/edit` (rename);
  - the same pages under `/orgs/:orgId/...`.
- **Routing:** the pages are added to `ROUTES_CONTEXT` (static paths before parameterized siblings), and a
  `SECTIONS_CONTEXT` row `['/todo/lists', '/todo/lists']` keeps the user on the module index when switching context.
- **Header:** a "To-do" link after the context switcher, shown only when logged in, whose href follows the active
  context.
- **Permissions:** `MANAGE_LISTS` (`admin`) is added to `orgPermissions.js`. Controls a role cannot use are hidden
  through `can()`, not disabled. A 403 renders `PermissionDenied` (refreshing the role), a 404 renders `NotFound`,
  and a 409 on list delete shows an "empty the list first" message.

### Tests

- **Role-enforcement matrix:** port `code_sample/backend/src/bank/tests/org-roles.e2e-spec.ts` and
  `bank/tests/support/owner-matrix.ts` to `backend/src/todo/tests/`. They run in the existing owner-scoped e2e
  harness style (Jest + supertest, in-memory membership lookup, no real DB) and cover:
  - the per-route minimum-role matrix (owner, admin, user, non-member);
  - `NOT_FOUND_CASES`, including an item under another list;
  - `ownerKeysIn` (no owner fields in any response).
- **Coverage specs:** restore the "> 0" assertions in `min-org-role.coverage.spec.ts`,
  `owner-scoped.coverage.spec.ts` and `cache-invalidation.coverage.spec.ts`, and add the todo controllers to
  `KNOWN_CONTROLLERS` in `core/tests/support/route-discovery.ts`.
- **Unit specs** for the service, controllers, DTOs and serializers; **Jasmine specs** for the pages, routes and
  `MANAGE_LISTS`.

### Docs and cleanup

- `docs/agents/modules/todo.md`: the module's spec and a **"Removing the todo module"** checklist covering:
  - the module and its `AppModule` import;
  - the migration;
  - the `KNOWN_CONTROLLERS` entries;
  - the routes, `SECTIONS_CONTEXT` row and header link;
  - `MANAGE_LISTS`;
  - `LIST_HAS_ITEMS`;
  - the docs.
- Link it from the module index, `docs/agents/modules/auth/organizations.md` and the architecture docs where the
  owner-context mechanism is described.
- Delete the ported `code_sample/` files and update `code-sample-backend.md` / `code-sample.md`.

### Reviews

Security, data-access and cache reviews run at planning time.

### Out of scope

- A cap on lists or items per owner, which is left to rate limiting as for organizations.
- Seed data.
- i18n of the "To-do" label.
- Per-user caching and proxy handling of `X-Cache-Invalidate` (#33).
- Docs-only work (#32).

## Benefits

- Derived projects get a working, tested template for a user-or-organization-owned module, and a checklist to
  remove it cleanly.
- The owner-context mechanism, role matrix and coverage specs are exercised by real routes instead of an empty set.
- The uniform 404 is proven one level down (child through its root), which is the most common hole in this design.
- Refusing to delete a non-empty list keeps writes fail-closed: no user data disappears as a side effect.
