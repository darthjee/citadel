# Issue: Organizations: owner-context mechanism (guard, decorators, org roles)

## Description

Part of epic #25 (Organizations: optional org ownership for domain data). Citadel is a project template;
organizations ship with it so derived projects can have domain data owned by an organization instead of a
single user. The target behaviour is specified in `docs/agents/specs/orgs/` (hub: `README.md`, and in
particular `owner-context.md`, `roles.md`, `security.md`, `caching.md`), and the original implementation is
mirrored under `docs/agents/specs/orgs/code_sample/` with the same paths as the real codebase.

This sub-issue brings the **owner-context mechanism** into `backend/src/core/`. It is the one place where a
request's owner (the JWT user, or an organization) is resolved, the caller's organization role is enforced,
and a write's cache invalidation is declared. It also adds the coverage specs that keep every future
owner-scoped controller honest.

**Approach (applies to every sub-issue of #25):** move files from `code_sample/` into their real location, then
adapt them to citadel, staying close to the original so fixes can flow between citadel and its derived projects.
Remove each `code_sample/` file once moved/reconciled, and fold what matters from the spec pages into the
permanent docs.

Depends on #26 (core groundwork): `parseOrgId()` reuses `parseId()`, and the plain-`@Body()` coverage spec relies
on `@StrictBody()`.

## Problem

- Without a shared mechanism, every owner-scoped module would answer on its own "who owns this request?",
  "is the caller allowed here?" and "which rows may be returned?". That duplicates a security decision, and
  one module will eventually get it subtly wrong: a missing owner filter, or the role checked before
  membership, which turns an endpoint into an existence oracle.
- `core/` must not import `auth/`, so the guard cannot read organization memberships directly. It needs a port.
- The real membership lookup (`OrganizationService`) only arrives with #28, yet the guard has to be registered
  globally now. Registered without any `ORGANIZATION_MEMBERSHIP_LOOKUP` provider, the app would fail to boot.
- The sample coverage tooling assumes ward: `KNOWN_CONTROLLERS` lists bank controllers, and the
  "discovers owner-scoped write routes (> 0)" assertion fails in citadel, which has no owner-scoped controller
  until the example module (#31). The sample's `route-discovery.ts` also collects plain-`@Body()` and
  invalidation metadata for two coverage specs that were not mirrored. Meanwhile citadel's
  `cache-policy.coverage.spec.ts` carries its own copy of the route-walking code.
- The sample's owner-scoped e2e spec expects ward's `X-Cache-Allow` cache model, which citadel does not have
  (#33).

## Expected Behavior

- **Roles.** `OrgRole` is `user` < `admin` < `owner`; `hasMinRole(role, min)` compares ranks;
  `orgRoleForbidden()` is the uniform 403 (`FORBIDDEN` / `Forbidden`, naming neither the resource nor the role).
- **Owner context.** `OwnerContext` is `{ kind: 'user', userId }` or
  `{ kind: 'organization', organizationId, role }`; `OwnerScope` is the same without `role`. `ownerRole(ctx)`
  answers `owner` for the personal context. `ownerWhere(scope)` always constrains both owner columns
  (`organizationId: IsNull()` for a user, `userId: IsNull()` for an organization); `ownerSqlWhere(scope, alias)`
  returns a parameterised fragment and rejects an alias that is not a plain SQL identifier.
- **Guard.** `OwnerContextGuard` is a global `APP_GUARD` registered **after `JwtGuard`**. It is a no-op for routes
  without `@OwnerScoped()`. On an owner-scoped route, the check order is the contract:
  1. no `request.user` -> uniform 404;
  2. no `:orgId` -> personal context (the JWT user), no lookup;
  3. `parseOrgId()` fails -> uniform 404 (no lookup);
  4. `findRole()` answers `null` -> uniform 404 (unknown, foreign or non-member, **global admins included**);
  5. role below `@MinOrgRole` -> uniform 403;
  6. the context is stored on `request.ownerContext` and the handler runs.
  The role is re-read through the port on every request, never cached, and never taken from a body, query
  or header.
- **Fail-closed default lookup.** Until #28, `ORGANIZATION_MEMBERSHIP_LOOKUP` is bound in `AppModule` to a
  `core/` default that answers `null` for every call, so any `/orgs/:orgId/...` route answers the uniform 404.
  #28 replaces that binding with `OrganizationService`.
- **Decorators.** `@OwnerScopedController(path)` mounts the controller under `<path>` and `orgs/:orgId/<path>`,
  marks it `@OwnerScoped()`, sets `@CachePolicy(CacheClass.UserScoped)` (so citadel's `X-Skip-Cache` applies)
  and declares `InvalidatesOwner()`. `@CurrentOwner()` injects the context and throws a 500 if it is
  missing (a programming error). `@MinOrgRole(role)` declares a route's minimum role.
- **Cache invalidation.** The global `CacheInvalidationInterceptor` sets `X-Cache-Invalidate` on a successful
  non-GET/HEAD response of a route that declares `InvalidatesOwner()` (`/<path>` or `/orgs/<id>/<path>`) or
  `InvalidatesPaths(build)`, never on an error, and drops unsafe paths. `NoCacheInvalidation()` and undeclared
  routes emit nothing. The proxy does not consume the header yet (#33).
- **Coverage specs** (static metadata only, no bootstrap, no DB), each with fixture tests proving it detects
  violations:
  - every owner-scoped write declares `@MinOrgRole` with a valid `OrgRole`;
  - an owner-scoped route never takes a plain `@Body()` (it uses `@StrictBody()`);
  - every owner-scoped write declares a cache invalidation, and no owner-scoped route is `public`.
  The "> 0 owner-scoped routes" assertion is dropped until #31 restores it (a comment is already on #31).
- **No behaviour change on any existing route.** No existing controller is owner-scoped or declares an
  invalidation, so the guard and the interceptor do nothing for them, and the existing suite passes unchanged.

## Solution

### Port from `code_sample/backend/src/core/`

Moved into `backend/src/core/`, staying close to the original (comments mentioning "Ward" made generic):

- `org-role.ts`, `owner-context.ts`, `owner-context.guard.ts`, `owner-scoped.decorator.ts`,
  `current-owner.decorator.ts`, `min-org-role.decorator.ts`, `organization-membership-lookup.ts`, `parse-org-id.ts`
- `cache-invalidation.decorator.ts` and `cache-invalidation.interceptor.ts`, unchanged (moved here from #26)
- specs: `org-role`, `owner-context`, `owner-context.guard`, `owner-scoped.decorator`, `current-owner.decorator`,
  `parse-org-id`, `cache-invalidation.decorator`, `min-org-role.coverage`, `owner-scoped.module.e2e-spec`,
  and `tests/support/route-discovery.ts`

### New in citadel

- A fail-closed default `OrganizationMembershipLookup` in `core/` (answers `null`), bound to
  `ORGANIZATION_MEMBERSHIP_LOOKUP` in `AppModule`, with its own spec.
- `AppModule`: `OwnerContextGuard` as an `APP_GUARD` right after `JwtGuard`, and `CacheInvalidationInterceptor`
  as an `APP_INTERCEPTOR`; `app.module.spec.ts` checks the guard order.
- `backend/src/types/express.d.ts`: `ownerContext?: OwnerContext` on `Request`.
- A `cache-invalidation.interceptor` spec (the sample has none): GET/HEAD skipped, header set on a successful
  write, none on an error, unsafe paths dropped, `owner`/`paths`/`none` resolution.
- The two coverage specs `route-discovery.ts` was built for: no plain `@Body()` on owner-scoped routes, and
  every owner-scoped write declares an invalidation while no owner-scoped route is `public`.

### Adaptations

- `route-discovery.ts`: `KNOWN_CONTROLLERS` lists citadel's controllers; `cache-policy.coverage.spec.ts` drops
  its own route-walking copy and uses the shared support file.
- The coverage specs drop the "discovers owner-scoped write routes (> 0)" assertion; #31 restores it.
- `owner-scoped.module.e2e-spec.ts` expects `X-Skip-Cache` on the user-scoped response, not `X-Cache-Allow`.
- No error-code changes: `FORBIDDEN` and `NOT_FOUND` already exist; the sample's extra codes are bank-only.

### Cleanup and docs

- Delete every `code_sample/` file this issue ports, and update `code-sample-backend.md` / `code-sample.md`.
- Fold the owner-context mechanism (flow, check order, layering rule, decorators, the fail-closed default) into
  the permanent docs (`docs/agents/architecture/backend.md`, `docs/agents/modules/auth/organizations.md`), and
  document `X-Cache-Invalidate` as emitted but not yet consumed in `docs/agents/architecture/caching.md`.

### Out of scope

Organization entities, migration, service, controller and the real membership lookup (#28); proxy handling of
`X-Cache-Invalidate` and per-user caching (#33); the example owner-scoped module (#31); frontend.

## Benefits

- Owner resolution, membership and role checks, and owner filters live in one place, so no domain module writes
  that security logic itself.
- The 404-before-403 order and the uniform 404 prevent organization enumeration, with no global-admin bypass.
- The coverage specs make it impossible to ship an owner-scoped write without a role, a strict body or a cache
  invalidation.
- The fail-closed default keeps the app bootable and safe before #28 lands, and leaves existing routes untouched.
- Staying close to the original keeps fixes portable between citadel and its derived projects.
