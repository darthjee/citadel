# Write architecture/owner-context.md

Create `docs/agents/architecture/owner-context.md`, the permanent home of the cross-cutting
owner-context mechanism, folded from the spec's `owner-context.md` and `roles.md` (plus the
coverage-spec parts of `tests.md`). Suggested sections:

- **Purpose**: domain data is owned by a user or by an organization; one guard resolves the
  owner and enforces the organization role.
- **Layering rule**: what lives in `core/` vs. the `auth` module, and the
  `ORGANIZATION_MEMBERSHIP_LOOKUP` port (link `organizations.md#the-port-binding` rather than
  repeating it).
- **The two contexts**: `{ kind: 'user', userId }` / `{ kind: 'organization', organizationId, role }`
  (use the exact shape from the code).
- **Guard flow and check order**, which is the contract: no user → 404; no `:orgId` → personal;
  `parseOrgId()` fails → 404; `findRole()` is `null` → 404 (no global-admin bypass); role below
  `@MinOrgRole` → 403. Include the `400 > 404 > 403` ordering with body validation.
- **Decorators and helpers**: `@OwnerScopedController(path)`, `@OwnerScoped()`, `@CurrentOwner()`,
  `@MinOrgRole()`, `ownerWhere()`, `ownerSqlWhere()`, and what `@OwnerScopedController` bundles
  (including its cache class).
- **Roles**: the `owner`/`admin`/`user` matrix, the capability split, the three enforcement points
  (backend guard, service, frontend `can()`), where the role comes from, the global `is_admin` is not
  an organization role, role changes mid-session, and how to add an action.
- **Ownership model for modules**: the owner-root pattern (nullable logical `user_id` /
  `organization_id` with a check constraint that exactly one is set; children inherit through the
  root; the user reference means owner, never creator), using **todo** as the worked example (link
  `modules/todo.md`).
- **Adding a new owner-scoped module**: a short checklist.
- **Tests**: the coverage spec(s) that enforce this and the failure-mode table (what to assert for
  each status).
- **What the guard does not do.**

Then update `docs/agents/architecture/backend.md`'s "Owner context" section (~line 186): keep its
summary bullets, and replace "Full specification: [owner-context.md](../specs/orgs/owner-context.md),
[roles.md](../specs/orgs/roles.md)" with a link to `owner-context.md`. Trim any bullet that now just
duplicates the new page.

## Files to Change

- `docs/agents/architecture/owner-context.md`: new page
- `docs/agents/architecture/backend.md`: "Owner context" section links to the new page instead of the spec
