# Issue: Organizations: backend entities, migration, service and /orgs routes

## Description

Part of epic #25 (Organizations: optional org ownership for domain data). Citadel is a project
template; organizations ship with it so derived projects can have domain data owned by an
organization instead of a single user. The target behaviour is specified in
`docs/agents/specs/orgs/` (hub: `README.md`, in particular `models.md`, `tables.md`, `migrations.md`,
`service.md`, `endpoints.md`, `response.md`, `caching.md`, `security.md`), and the original
implementation is mirrored under `docs/agents/specs/orgs/code_sample/`, with the same paths as in the
real codebase.

This sub-issue implements the **organizations backend**: the two entities, their migration,
`OrganizationService` (the only membership writer, and the real `ORGANIZATION_MEMBERSHIP_LOOKUP`),
and the four `/orgs` routes. Registration still creates no organization; zero organizations is the
normal state.

**Approach (applies to every sub-issue of #25):** move files from `code_sample/` into their real
location, then adapt them to citadel, staying close to the original so fixes can flow between citadel
and its derived projects. Where a file already exists in citadel, reconcile the two (merge the
organization-related changes) rather than overwrite. Remove each `code_sample/` file once
moved/reconciled, and fold what matters from the spec pages into the permanent docs.

Depends on #27 (owner-context mechanism, merged): the guard, decorators, `parseOrgId()`,
`CacheInvalidationInterceptor` and the fail-closed `NoOrganizationMembershipLookup` this issue
replaces.

## Problem

- Until now `ORGANIZATION_MEMBERSHIP_LOOKUP` is bound in `AppModule` to
  `NoOrganizationMembershipLookup` (#27), so every `/orgs/:orgId/...` request answers the uniform 404.
  There is no organization data, no way to create one and no real membership lookup.
- Several citadel files already exist and differ from the sample: `auth.module.ts`, `user.entity.ts`
  (the sample also carries ward's unrelated `locale` column), and the test support
  `build-auth-test-app.ts` / `in-memory-repo.ts`, which lack the organization repos, the `In()`
  operator, the owner-context guard option and the invalidation interceptor.
- The sample ships no MySQL integration spec, and citadel's integration setup (#19) is service-level
  only (a `DataSource` plus migrations, no app boot).
- The sample's tests and comments assume ward's `X-Cache-Allow` cache model, which citadel does not
  have (#33).

## Expected Behavior

- **Tables.** A new migration creates `auth_organizations` and `auth_organization_memberships`: both
  foreign keys `ON DELETE RESTRICT`, the unique index `(organization_id, user_id)` and the `user_id`
  index. It runs after the existing `...120014` migration and has a `down()`.
- **Service.** `OrganizationService` is the **only** membership writer. `create` writes the
  organization and its single `owner` membership in the same transaction. It also offers
  `listForUser`, `findMembership`, `findRole` and `rename` (role `admin` or above; uniform 403 for a
  `user`, uniform 404 for a non-member).
- **Port.** `AuthModule` provides `ORGANIZATION_MEMBERSHIP_LOOKUP` with `useExisting:
  OrganizationService` and exports it together with `OrganizationService`, as in the sample.
  `AppModule` drops its binding, so the global `OwnerContextGuard` now resolves real roles.
- **Routes** (thin controller, JWT-protected, no `@Public()`, no `is_admin` bypass):
  - `GET /orgs.json`: the caller's organizations with their role, ordered by id (`user-scoped`).
  - `POST /orgs.json`: creates an organization; the caller becomes `owner` (`never`, invalidates
    `/orgs.json`).
  - `GET /orgs/:orgId.json`: one organization the caller belongs to (`user-scoped`).
  - `PATCH /orgs/:orgId.json`: rename; order 400 body -> 404 membership -> 403 role (`never`,
    invalidates `/orgs.json` and `/orgs/<id>.json`).
  - Bodies only through `@StrictBody()` (unknown fields such as `role` or `organizationId` answer
    400); `:orgId` only through `parseOrgId()`; every miss (unknown, malformed, foreign, non-member,
    global admin included) answers the uniform 404. Names are never logged.
- **Response allowlist:** `id`, `name`, the caller's `role`, and the timestamps; nothing else.
- **Cache.** The GETs are `user-scoped` (so they send `X-Skip-Cache`), the writes `never`. Writes emit
  `X-Cache-Invalidate` (not consumed by the proxy yet, #33). Navi warms nothing new: no organization
  route is public.
- **No behaviour change** for existing routes and for registration (no organization is created).

## Solution

### Port from `code_sample/backend/src/`

Moved into place, staying close to the original (comments mentioning "Ward" made generic):

- `auth/entities/organization.entity.ts`, `auth/entities/organization-membership.entity.ts`
- `database/migrations/20261107120015-auth-create-organizations.ts` (the name already follows
  citadel's order: it comes after `20261019120014`)
- `auth/organization.service.ts`, `auth/organization.controller.ts`, `auth/organization-response.ts`,
  `auth/organization-invalidation.ts`, `auth/dto/organization-name.dto.ts`
- specs: `organization.service`, `organization-name.dto`, `organization-response`,
  `organization-invalidation`, the four `organization.controller.*.e2e-spec.ts` with their
  `e2e-test-support`, `owner-scoped.e2e-spec.ts` with its `e2e-test-support`, and
  `tests/support/in-memory-organization-repos.ts`

### Reconcile with existing citadel files

- `auth/auth.module.ts`: register the entities, the controller, `OrganizationService`, the port
  binding, and the exports.
- `auth/entities/user.entity.ts`: take only organization-related changes; do **not** port ward's
  `locale` column.
- `auth/tests/support/build-auth-test-app.ts`: the in-memory organization repos, the
  `ownerContextGuard` option, and the `CacheInvalidationInterceptor`; comments keep citadel's
  `X-Skip-Cache` model (no `X-Cache-Allow`).
- `auth/tests/support/in-memory-repo.ts`: the `In()` operator and the typed update builder.
- `auth/tests/repo-mock.test-support.ts`: reconcile if it differs.

### The port swap

- `AppModule` removes the `ORGANIZATION_MEMBERSHIP_LOOKUP` binding (and its comment).
- Delete `core/no-organization-membership-lookup.ts` and its spec.
- Update `core/tests/app.module.spec.ts` (it currently asserts the `NoOrganizationMembershipLookup`
  binding) to check that the port resolves to `OrganizationService` through `AuthModule`.

### Coverage and cache

- Add `OrganizationController` to `KNOWN_CONTROLLERS` in `core/tests/support/route-discovery.ts`, so
  the cache-policy and invalidation coverage specs see it.
- Every route declares a cache class (GETs `user-scoped`, writes `never`), and the e2e specs assert
  `X-Skip-Cache` on the GETs and `X-Cache-Invalidate` on the writes.

### MySQL integration test

`auth/tests/integration/organization.service.integration-spec.ts`, following the existing
service-level pattern (`createTestDataSource`, `resetDatabase`, `runMigrations`): `create` writes the
organization and the `owner` row in one transaction; `listForUser`, `findMembership`, `findRole` and
`rename` work against MySQL; the unique `(organization_id, user_id)` index holds; `ON DELETE
RESTRICT` blocks deleting a user or an organization that still has memberships. The routes and the
guard's 404-before-403 contract stay covered by the ported in-memory e2e specs (no app boot on MySQL).
Add `database/tests/auth-create-organizations-migration.spec.ts` (fake query runner), like the specs for migrations 11 to 14.

### Cleanup and docs

- Delete every `code_sample/` file this issue ports or reconciles, and update `code-sample-backend.md`,
  `code-sample-migrations.md` and `code-sample.md`.
- Fold the organizations backend (tables, service rules, routes, response allowlist, cache classes,
  the port binding) into `docs/agents/modules/auth/organizations.md` (new) and
  `docs/agents/modules/auth.md`, and update the "fail-closed default" wording #27 left in
  `docs/agents/architecture/backend.md` and `code-sample-backend.md`.

### Out of scope

- `bank/tests/org-roles.e2e-spec.ts` and `bank/tests/support/owner-matrix.ts` stay in `code_sample/`
  for #31 (example owner-scoped module).
- Roadmap items in `roadmap.md` (joining, closing, rate limit, move, share, authorship).
- Proxy handling of `X-Cache-Invalidate` and per-user caching (#33).
- Frontend (#29, #30).

## Benefits

- Organizations become real: users can create, list, view and rename them, and the owner-context
  guard resolves real roles, unblocking the frontend (#29, #30) and the example module (#31).
- One membership writer and one transaction for create keep the "exactly one owner at birth"
  invariant in a single place.
- The uniform 404, the 400 -> 404 -> 403 order and the response allowlist keep organizations from
  being enumerated or leaking fields.
- The MySQL spec proves the constraints (transaction, unique index, `ON DELETE RESTRICT`) that the
  in-memory repos cannot.
- Staying close to the original keeps fixes portable between citadel and its derived projects.
