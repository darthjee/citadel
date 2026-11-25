# Auth — Organizations

Optional organization ownership: a group of users that can own domain data instead of a single
user. Part of the [Auth module](../auth.md). Zero organizations is the normal state —
registration creates none; a user creates one explicitly with `POST /orgs.json`.

The full target behaviour (examples, edge cases, roadmap) is specified in
[`docs/agents/specs/orgs/`](../../specs/orgs/README.md). This page records what is **implemented**.
The owner-context mechanism used by owner-scoped modules (`OwnerContextGuard`, `@OwnerScoped()`,
`@MinOrgRole`, `parseOrgId()`) is described in
[Backend architecture](../../architecture/backend.md#owner-context-organizations).

## Tables

Created by `database/migrations/20261107120015-auth-create-organizations.ts` (runs after
`20261019120014`; `down()` drops the memberships table, then the organizations table).

| Table | Entity | Columns |
|---|---|---|
| `auth_organizations` | `entities/organization.entity.ts` (`Organization`) | `id`, `name` (`varchar(255)`, **not unique**), `created_at`, `updated_at` |
| `auth_organization_memberships` | `entities/organization-membership.entity.ts` (`OrganizationMembership`) | `id`, `organization_id`, `user_id`, `role` (`varchar(16)`: `user` / `admin` / `owner`), `created_at`, `updated_at` |

Constraints on `auth_organization_memberships`:

- unique index `idx_auth_organization_memberships_organization_id_user_id` on
  `(organization_id, user_id)` — at most one membership per user per organization; also the
  membership-check lookup;
- index `idx_auth_organization_memberships_user_id` — "list my organizations";
- **real** foreign keys (all three tables are owned by `auth`, unlike the module's logical user
  references): `organization_id` → `auth_organizations.id` and `user_id` → `auth_users.id`, both
  `ON DELETE RESTRICT`. A user or organization that still has a membership cannot be deleted.

There is no owner column: ownership lives only in the membership role. The "exactly one owner at
birth" rule is held by the service, not by the schema.

## `OrganizationService`

`auth/organization.service.ts`, exported by `AuthModule`. It is the **only** writer of
memberships; other modules read memberships only through it, never by querying the tables.

| Method | Behaviour |
|---|---|
| `create(userId, name)` | Writes the organization and its single `owner` membership in one `manager.transaction` (both rolled back on failure). The role is always `owner`, never taken from input. |
| `listForUser(userId)` | The user's organizations with their role in each, ordered by id (empty for zero organizations). |
| `findMembership(userId, orgId)` | The membership plus its organization, or `null` for a non-member / unknown organization. |
| `findRole(userId, orgId)` | Implements `OrganizationMembershipLookup`: one lookup on the unique key, `null` for a non-member (same cost for an unknown organization, so ids cannot be enumerated). |
| `rename(userId, orgId, name)` | Uniform 404 (`ownerNotFound()`) for a non-member, then uniform 403 (`orgRoleForbidden()`) below `admin`; last write wins among admins/owners. |

No global-admin bypass (`User.isAdmin` grants no organization access), no caching between
requests, and names are never logged.

### The port binding

`AuthModule` provides Core's `ORGANIZATION_MEMBERSHIP_LOOKUP` port with
`{ provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useExisting: OrganizationService }` and exports it
together with `OrganizationService`. `useExisting` keeps **one** service instance shared by the
controller and the global `OwnerContextGuard` (declared in `AppModule`), which resolves real roles
through it; `core/` still never imports `auth/`.

## Routes (`OrganizationController`)

`auth/organization.controller.ts` — thin, no path prefix, JWT-protected (no `@Public()`), not
owner-scoped (it *is* the organization). `:orgId` is read as a raw string and parsed only by
`parseOrgId()`; bodies come only through `@StrictBody()` (`OrganizationNameDto`: `name` only, so
`role` or `organizationId` in a body answer 400).

| Route | Cache class | Invalidates | Response |
|---|---|---|---|
| `GET /orgs.json` | `user-scoped` | — | `[organization]`, ordered by id |
| `POST /orgs.json` | `never` | `/orgs.json` | `201`, `organization` with `role: "owner"` |
| `GET /orgs/:orgId.json` | `user-scoped` | — | `organization` |
| `PATCH /orgs/:orgId.json` | `never` | `/orgs.json`, `/orgs/<id>.json` | `organization` |

- **Name rules** (`dto/organization-name.dto.ts`): trimmed, non-empty, at most 255 **code points**
  (`MaxCodePoints`, `core/string-validators.ts`), no Unicode control characters (`Cc`).
- **Uniform 404:** every miss — unknown, malformed (`1e3`, `01`, `abc`), foreign, non-member, a
  non-member global admin — answers the same 404 body.
- **Rename order:** 400 body → 404 membership → 403 role. The body is validated first, which is
  safe: the 400 depends only on the body and cannot enumerate organizations.
- **Response allowlist** (`organization-response.ts`, `serializeOrganization`): exactly
  `{ id, name, role, created_at, updated_at }`, where `role` is the caller's. Never member lists or
  other users' ids.
- **Cache:** the GETs send `X-Skip-Cache: true` / `Cache-Control: private, no-store`; the writes
  send `no-store` and, on success, `X-Cache-Invalidate` (`organization-invalidation.ts`; never
  `/orgs`, whose recursive clear would wipe every organization's tree). The proxy does not consume
  `X-Cache-Invalidate` yet (#33). Navi warms nothing: no organization route is public.

## Testing

- Unit: `auth/tests/organization.service.spec.ts`, `organization-name.dto.spec.ts`,
  `organization-response.spec.ts`, `organization-invalidation.spec.ts`,
  `core/tests/string-validators.spec.ts`.
- E2e (in-memory repos, `auth/tests/support/in-memory-organization-repos.ts` with a fake
  transaction manager): `organization.controller.{create,read,rename,not-found}.e2e-spec.ts` and
  `owner-scoped.e2e-spec.ts` (the guard over the real service, using the test-only
  `WidgetsTestController`; `buildAuthTestApp({ ownerContextGuard: true })`).
- Migration: `database/tests/auth-create-organizations-migration.spec.ts` (fake query runner).
- MySQL (`yarn test:integration`): `auth/tests/integration/organization.service.integration-spec.ts`
  proves what the in-memory repos cannot — the transaction and its rollback, the unique index and
  `ON DELETE RESTRICT`.
- Coverage: `OrganizationController` is in `KNOWN_CONTROLLERS`
  (`core/tests/support/route-discovery.ts`), so the cache-policy and cache-invalidation coverage
  specs check it.
