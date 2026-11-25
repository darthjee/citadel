# Docs and code_sample cleanup

## Module doc

`docs/agents/modules/todo.md` (new) is the module's spec. Follow the shape of `docs/agents/modules/auth.md`:

- **Purpose:** a live example of a user-or-organization-owned module, kept in citadel and meant to be copied from or
  removed by derived projects.
- **Routes:** the route/role table from [plan.md](../plan.md#shared-contracts), both contexts, response shapes and
  status codes, and the status-check order.
- **Ownership:**
  - a list is the owner root, with logical `user_id`/`organization_id` and the exactly-one CHECK;
  - an item inherits the owner through its list and is only found through it;
  - the uniform 404 applies one level down.
- **Access control:** who can read and write lists and items (the data-access review asked for this explicitly).
  There is no global-admin bypass.
- **Entities:** `todo_lists` and `todo_items`, with columns, indexes, the FK RESTRICT, and the 409 `LIST_HAS_ITEMS`
  (including the race mapping).
- **Cache:**
  - user-scoped (`X-Skip-Cache`);
  - writes invalidate `/todo` or `/orgs/<id>/todo`;
  - Navi warms nothing;
  - per-user caching is #33.
- **Out of scope:** per-owner caps and rate limiting. No backend throttler exists today, so state this plainly rather
  than claiming a limit; seed data and i18n are also out.
- **Frontend:** pages, `SECTIONS_CONTEXT` row, header link and `MANAGE_LISTS`. The frontend agent supplies this
  section, or the backend agent writes it from the contract.
- **Removing the todo module:** a checklist:
  1. `backend/src/todo/` and the `TodoModule` import in `app.module.ts`;
  2. the migration. For an already-migrated DB, add a drop migration rather than deleting the file;
  3. `'TodoController'` in `KNOWN_CONTROLLERS`. Keep at least one owner-scoped controller, or re-comment the three
     "> 0" coverage assertions;
  4. `LIST_HAS_ITEMS` in `core/error-codes.ts`;
  5. the frontend `todo` pages, the `ROUTES_CONTEXT` entries, the `SECTIONS_CONTEXT` row, the header link,
     `TodoClient` and `MANAGE_LISTS`;
  6. this doc and its links.

## Links and permanent docs

- Link `todo.md` from the modules index, from `docs/agents/modules/auth/organizations.md` (as the worked example),
  and from `docs/agents/architecture/backend.md` where the owner-context mechanism is described.
- Add the todo routes to `docs/agents/backend/routes.md` (or its index).
- Update `docs/agents/folder-structure.md` if it lists `backend/src/<module>` folders.

## code_sample cleanup

- Delete `docs/agents/specs/orgs/code_sample/backend/src/bank/` (both files), once they are ported.
- Update `docs/agents/specs/orgs/code-sample.md` and `code-sample-backend.md`:
  - mark the two bank files as ported in #31;
  - update the remaining-file counts. Only `core/cache-class.ts` and `core/cache-policy.interceptor.ts` (#33) remain
    on the backend side.

## Files to Change

- `docs/agents/modules/todo.md`: new.
- `docs/agents/modules/auth/organizations.md`, `docs/agents/architecture/backend.md`, `docs/agents/backend/routes.md`,
  `docs/agents/index.md` or the modules index: links.
- `docs/agents/specs/orgs/code-sample.md`, `docs/agents/specs/orgs/code-sample-backend.md`: counts and status.
- `docs/agents/specs/orgs/code_sample/backend/src/bank/tests/org-roles.e2e-spec.ts`: delete.
- `docs/agents/specs/orgs/code_sample/backend/src/bank/tests/support/owner-matrix.ts`: delete.
