# Organizations - Code Sample - Backend

Part 1 of 3. Index: [Code Sample](./code-sample.md).
Next: [Migrations](./code-sample-migrations.md).

**67 files plus 2 directories.** Every path below was read from the repository tree on branch
`main`.

**Status after #26:** 22 of these rows are no longer under `code_sample/`, so **45 files plus 2
directories remain**. Rows marked "ported in #26" were moved to the real path shown; rows marked
"already in citadel, no port" were identical to citadel's file (or differed only by the `WARD_*` vs
`CITADEL_PLACEHOLDER_*` env prefix, or by `bank`-only error codes) and were deleted. Their links now
point at citadel's own file.

## What this part covers

| Group | Files | Still in `code_sample/` after #26 |
|---|---|---|
| Entities | 3 | 3 |
| Service, controller, response, DTO, module | 6 | 6 |
| Core - access control | 27 | 13 |
| Tests - organizations | 12 + 1 directory | 12 + 1 directory |
| Tests - core | 17 + 1 directory | 9 + 1 directory |
| Bank reference for role enforcement | 2 | 2 |

Copy in the order below. The entities come first because the service imports them; the core layer
comes before the tests because the tests import it.

## 1. Entities

| File | Role |
|---|---|
| [backend/src/auth/entities/organization.entity.ts](./code_sample/backend/src/auth/entities/organization.entity.ts) | `Organization` - table `auth_organizations` |
| [backend/src/auth/entities/organization-membership.entity.ts](./code_sample/backend/src/auth/entities/organization-membership.entity.ts) | `OrganizationMembership` - table `auth_organization_memberships`, carries `role` |
| [backend/src/auth/entities/user.entity.ts](./code_sample/backend/src/auth/entities/user.entity.ts) | `User` - the source of `isAdmin`; referenced by the membership foreign key |

Two entities and no third one: there is no `OrganizationOwner`, `OrganizationInvite` or
`OrganizationSettings`. `user.entity.ts` is listed because the membership references it - without
it the foreign key and the `isAdmin` flag have no source.

## 2. Service, controller, response, DTO, module

| File | Role |
|---|---|
| [backend/src/auth/organization.service.ts](./code_sample/backend/src/auth/organization.service.ts) | `OrganizationService` - the **single writer of memberships**; implements the membership-lookup port; holds the rename role check |
| [backend/src/auth/organization.controller.ts](./code_sample/backend/src/auth/organization.controller.ts) | `OrganizationController` - the four routes, no path prefix |
| [backend/src/auth/organization-response.ts](./code_sample/backend/src/auth/organization-response.ts) | The serializer producing `{ id, name, role, created_at, updated_at }` |
| [backend/src/auth/organization-invalidation.ts](./code_sample/backend/src/auth/organization-invalidation.ts) | Cache invalidation for the organization routes |
| [backend/src/auth/dto/organization-name.dto.ts](./code_sample/backend/src/auth/dto/organization-name.dto.ts) | `OrganizationNameDto` - `name` only, trimmed, 255 code points, no `Cc` |
| [backend/src/auth/auth.module.ts](./code_sample/backend/src/auth/auth.module.ts) | `AuthModule` - registers `OrganizationService` and binds `ORGANIZATION_MEMBERSHIP_LOOKUP` to it with **`useExisting`** |

`auth.module.ts` is the file that decides there is **one** service instance, not two. With
`useFactory` or a second provider entry, the controller and the guard would talk to different
objects. It also contains the rest of the auth module - keep the existing registrations.

## 3. Core - roles and errors

Base: `backend/src/core/`.

| File | Role |
|---|---|
| [org-role.ts](./code_sample/backend/src/core/org-role.ts) | The three roles, `hasMinRole()`, `orgRoleForbidden()` |
| [error-codes.ts](../../../../backend/src/core/error-codes.ts) | The `FORBIDDEN` / `NOT_FOUND` / `UNAUTHORIZED` constants used by the error bodies - **already in citadel, no port** (only `bank` codes differed; org-specific codes, if any, come with #27) |

## 4. Core - owner context

| File | Role |
|---|---|
| [owner-context.ts](./code_sample/backend/src/core/owner-context.ts) | `ownerWhere()`, `ownerSqlWhere()`, and the `OwnerContext` / `OwnerScope` types |
| [owner-context.guard.ts](./code_sample/backend/src/core/owner-context.guard.ts) | `OwnerContextGuard` - global `APP_GUARD`, resolves the owner and enforces the minimum role |
| [owner-scoped.decorator.ts](./code_sample/backend/src/core/owner-scoped.decorator.ts) | `@OwnerScoped()` and `@OwnerScopedController()` |
| [current-owner.decorator.ts](./code_sample/backend/src/core/current-owner.decorator.ts) | `@CurrentOwner()` - injects the resolved context |
| [min-org-role.decorator.ts](./code_sample/backend/src/core/min-org-role.decorator.ts) | `@MinOrgRole()` - declares a route's minimum role |
| [organization-membership-lookup.ts](./code_sample/backend/src/core/organization-membership-lookup.ts) | The `ORGANIZATION_MEMBERSHIP_LOOKUP` port the guard depends on |
| [parse-org-id.ts](./code_sample/backend/src/core/parse-org-id.ts) | `parseOrgId()` - parses `:orgId` from a **raw string**, so `1e3` is never coerced |
| [parse-id.ts](../../../../backend/src/core/parse-id.ts) | The generic strict id parser `parseOrgId()` builds on - **ported in #26** to `backend/src/core/parse-id.ts` |

`owner-context.ts` is also where the `OwnerContext` and `OwnerScope` types live - the documentation
gave their shape without naming the declaring file.

## 5. Core - authentication gate

Not part of the organizations feature, but the organization routes do not work without it.

Every file in this section is **already in citadel, no port** (#26): the sample copies were
identical, or differed only by the `WARD_*` vs `CITADEL_PLACEHOLDER_*` env prefix.

| File | Role |
|---|---|
| [jwt.guard.ts](../../../../backend/src/core/jwt.guard.ts) | `JwtGuard` - reads the `access_token` cookie, verifies signature and expiry with key rotation, validates the `sid` / `sub` claims, and loads `request.user` from the session |
| [session-lookup.ts](../../../../backend/src/core/session-lookup.ts) | The `SESSION_LOOKUP` port and its `SessionLookup` interface |
| [access-token-payload.ts](../../../../backend/src/core/access-token-payload.ts) | The `AccessTokenPayload` type - `{ sub, sid, username, isAdmin }` |
| [public.decorator.ts](../../../../backend/src/core/public.decorator.ts) | `@Public()` - the metadata key `JwtGuard` reads to skip verification |
| [boolean-metadata.ts](../../../../backend/src/core/boolean-metadata.ts) | `readBooleanMetadata()` - shared by `JwtGuard` and `OwnerContextGuard` |
| [current-user.decorator.ts](../../../../backend/src/core/current-user.decorator.ts) | `@CurrentUser()` - injects `request.user` |
| [secret-keys.ts](../../../../backend/src/core/secret-keys.ts) | `buildSecretKeys()` - the current and previous keys used by the rotation |
| [admin.guard.ts](../../../../backend/src/core/admin.guard.ts) | `AdminGuard` - the **global admin** guard, unrelated to organization roles |
| [admin-only.decorator.ts](../../../../backend/src/core/admin-only.decorator.ts) | `@AdminOnly()` - the counterpart of `AdminGuard` |

`admin.guard.ts` and `admin-only.decorator.ts` are included for contrast only: the global admin
grants **no** organization access. If the replica drops the platform admin concept entirely, these
two can be omitted along with their references.

## 6. Core - body validation

| File | Role |
|---|---|
| [strict-validation.pipe.ts](../../../../backend/src/core/strict-validation.pipe.ts) | `@StrictBody()` - rejects unknown body fields, which is what closes the body as an owner source - **ported in #26** to `backend/src/core/strict-validation.pipe.ts` |

This file is the reason a `role` or `organizationId` in a request body answers `400`. Without it, a
plain `@Body()` would accept those fields silently.

## 7. Core - cache policy

| File | Role |
|---|---|
| [cache-class.ts](./code_sample/backend/src/core/cache-class.ts) | The `CacheClass` enum - `Never`, `UserScoped`, `Public` |
| [cache-policy.decorator.ts](../../../../backend/src/core/cache-policy.decorator.ts) | `@CachePolicy(CacheClass)` - declared on the organization controller - **already in citadel, no port** |
| [cache-policy.interceptor.ts](./code_sample/backend/src/core/cache-policy.interceptor.ts) | Emits `X-Skip-Cache` and `Cache-Control` |
| [cache-invalidation.decorator.ts](./code_sample/backend/src/core/cache-invalidation.decorator.ts) | `@CacheInvalidation()` - declared on the write routes |
| [cache-invalidation.interceptor.ts](./code_sample/backend/src/core/cache-invalidation.interceptor.ts) | The invalidation interceptor |
| [cache-token.service.ts](../../../../backend/src/core/cache-token.service.ts) | The per-caller token behind `user-scoped` - **already in citadel, no port** (env prefix only) |

## 8. Tests - organizations

Base: `backend/src/auth/tests/`.

| File | Covers |
|---|---|
| [organization.service.spec.ts](./code_sample/backend/src/auth/tests/organization.service.spec.ts) | `OrganizationService` - create, rename, the single-writer rule |
| [organization-response.spec.ts](./code_sample/backend/src/auth/tests/organization-response.spec.ts) | The five-field serializer |
| [organization-name.dto.spec.ts](./code_sample/backend/src/auth/tests/organization-name.dto.spec.ts) | Name validation, including the code-point limit |
| [organization.controller.create.e2e-spec.ts](./code_sample/backend/src/auth/tests/organization.controller.create.e2e-spec.ts) | `POST /orgs.json` - the `201` and `role: "owner"` |
| [organization.controller.read.e2e-spec.ts](./code_sample/backend/src/auth/tests/organization.controller.read.e2e-spec.ts) | `GET /orgs.json` and `GET /orgs/:orgId.json` |
| [organization.controller.rename.e2e-spec.ts](./code_sample/backend/src/auth/tests/organization.controller.rename.e2e-spec.ts) | `PATCH /orgs/:orgId.json`, including the `400` > `404` > `403` order |
| [organization.controller.not-found.e2e-spec.ts](./code_sample/backend/src/auth/tests/organization.controller.not-found.e2e-spec.ts) | The uniform `404` across every failure case |
| [organization-invalidation.spec.ts](./code_sample/backend/src/auth/tests/organization-invalidation.spec.ts) | Cache invalidation on write |
| [organization.controller.e2e-test-support.ts](./code_sample/backend/src/auth/tests/organization.controller.e2e-test-support.ts) | Shared fixtures for the controller specs above |
| [owner-scoped.e2e-spec.ts](./code_sample/backend/src/auth/tests/owner-scoped.e2e-spec.ts) | The owner-scoped contract end to end |
| [owner-scoped.e2e-test-support.ts](./code_sample/backend/src/auth/tests/owner-scoped.e2e-test-support.ts) | Fixtures for the above |
| [repo-mock.test-support.ts](./code_sample/backend/src/auth/tests/repo-mock.test-support.ts) | Repository mocks used by the service specs |
| [support/](./code_sample/backend/src/auth/tests/support/) | Shared test support - **copy the whole directory** |

## 9. Tests - core

Base: `backend/src/core/tests/`.

| File | Covers |
|---|---|
| [org-role.spec.ts](./code_sample/backend/src/core/tests/org-role.spec.ts) | `hasMinRole()` ranking and the 403 body |
| [owner-context.spec.ts](./code_sample/backend/src/core/tests/owner-context.spec.ts) | `ownerWhere()` and `ownerSqlWhere()` |
| [owner-context.guard.spec.ts](./code_sample/backend/src/core/tests/owner-context.guard.spec.ts) | The guard: resolution order, 404 before 403 |
| [owner-scoped.decorator.spec.ts](./code_sample/backend/src/core/tests/owner-scoped.decorator.spec.ts) | `@OwnerScoped()` and `@OwnerScopedController()` |
| [owner-scoped.module.e2e-spec.ts](./code_sample/backend/src/core/tests/owner-scoped.module.e2e-spec.ts) | Module wiring of the owner-scoped mechanism |
| [**min-org-role.coverage.spec.ts**](./code_sample/backend/src/core/tests/min-org-role.coverage.spec.ts) | **The coverage spec** - fails the build on a plain `@Body()` or an owner-scoped route declared `public` |
| [parse-org-id.spec.ts](./code_sample/backend/src/core/tests/parse-org-id.spec.ts) | `parseOrgId()`, including the `1e3` case |
| [parse-id.spec.ts](../../../../backend/src/core/tests/parse-id.spec.ts) | The generic id parser - **ported in #26** to `backend/src/core/tests/parse-id.spec.ts` |
| [current-owner.decorator.spec.ts](./code_sample/backend/src/core/tests/current-owner.decorator.spec.ts) | `@CurrentOwner()` |
| [current-user.decorator.spec.ts](../../../../backend/src/core/tests/current-user.decorator.spec.ts) | `@CurrentUser()` - **already in citadel, no port** |
| [strict-validation.pipe.spec.ts](../../../../backend/src/core/tests/strict-validation.pipe.spec.ts) | `@StrictBody()` rejecting unknown fields - **ported in #26** to `backend/src/core/tests/strict-validation.pipe.spec.ts` (extended with edge cases) |
| [jwt.guard.spec.ts](../../../../backend/src/core/tests/jwt.guard.spec.ts) | The `401` gate, key rotation, session lookup - **already in citadel, no port** (env prefix only) |
| [admin.guard.spec.ts](../../../../backend/src/core/tests/admin.guard.spec.ts) | `AdminGuard` - the global admin path - **already in citadel, no port** |
| [http-exception.filter.spec.ts](../../../../backend/src/core/tests/http-exception.filter.spec.ts) | The uniform error body shape - **already in citadel, no port** |
| [cache-invalidation.decorator.spec.ts](./code_sample/backend/src/core/tests/cache-invalidation.decorator.spec.ts) | `@CacheInvalidation()` |
| [cache-token.service.spec.ts](../../../../backend/src/core/tests/cache-token.service.spec.ts) | The per-caller cache token - **already in citadel, no port** (env prefix only) |
| [app.module.spec.ts](../../../../backend/src/core/tests/app.module.spec.ts) | Global guard registration order - `JwtGuard` before `OwnerContextGuard` - **already in citadel, no port** (env prefix only) |
| [support/](./code_sample/backend/src/core/tests/support/) | Shared test support - **copy the whole directory** |

`min-org-role.coverage.spec.ts` is the file the project documentation referred to without ever
naming. It is the single most important test file in this list: without it, a new route can
silently opt out of the owner-scoped contract while the whole suite stays green.

## 10. Bank reference for role enforcement

`bank` is the only owner-scoped module today, so its tests are the working example of the
`@MinOrgRole` matrix applied to a real domain.

| File | Covers |
|---|---|
| [backend/src/bank/tests/org-roles.e2e-spec.ts](./code_sample/backend/src/bank/tests/org-roles.e2e-spec.ts) | Organization roles applied across an owner-scoped module |
| [backend/src/bank/tests/support/owner-matrix.ts](./code_sample/backend/src/bank/tests/support/owner-matrix.ts) | The per-route minimum-role matrix as data |

These two are optional. Include them only if the replica keeps a second module; they are not
required for the organizations routes themselves.

## Minimum set for a working backend

If the goal is a runnable feature rather than a complete mirror:

1. The three entity files.
2. `organization.service.ts`, `organization.controller.ts`, `organization-response.ts`,
   `organization-invalidation.ts`, `organization-name.dto.ts`, `auth.module.ts`.
3. `org-role.ts`, `owner-context.ts`, `owner-context.guard.ts`, `parse-org-id.ts`, `parse-id.ts`,
   `error-codes.ts`.
4. `owner-scoped.decorator.ts`, `current-owner.decorator.ts`, `min-org-role.decorator.ts`,
   `organization-membership-lookup.ts`, `strict-validation.pipe.ts`.
5. `jwt.guard.ts`, `session-lookup.ts`, `access-token-payload.ts`, `public.decorator.ts`,
   `boolean-metadata.ts`, `secret-keys.ts`.
6. `cache-class.ts`, `cache-policy.decorator.ts`, `cache-policy.interceptor.ts`.

That is **29 files** - the build passes and the four routes work. Everything else in this part is
tests, cache invalidation on write, or the global-admin contrast.

## Checklist

| Group | Files | Done |
|---|---|---|
| Entities | 3 | |
| Service, controller, response, DTO, module | 6 | |
| Core - roles and errors | 2 | |
| Core - owner context | 8 | |
| Core - authentication gate | 9 | |
| Core - body validation | 1 | |
| Core - cache policy | 6 | |
| Tests - organizations | 12 + dir | |
| Tests - core | 17 + dir | |
| Bank reference | 2 | |
