# Organizations - Service

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Models](./models.md), [Roles](./roles.md), [Owner context](./owner-context.md),
[Endpoints](./endpoints.md).

## Summary

`OrganizationService` (`backend/src/auth/organization.service.ts`) is the only place that reads or
writes organizations and memberships.

- It is the **single writer of memberships** in the entire codebase - the reason the
  "exactly one owner" invariant holds.
- It **implements the `ORGANIZATION_MEMBERSHIP_LOOKUP` port**, so the owner-context guard can read
  a role without `core/` importing `auth/`.
- It **checks roles itself on the organization routes**, because those routes are not
  owner-scoped and `@MinOrgRole` does not apply to them.
- It is injected into `OrganizationController`, which stays a thin delegation layer.

## Responsibilities

| Responsibility | Detail |
|---|---|
| Create an organization | Inserts the organization and one `owner` membership in a single DB transaction |
| Rename an organization | Validates the caller's role, then writes the new name |
| List the caller's organizations | Backs `GET /orgs.json`, ordered by id |
| Read one organization | Backs `GET /orgs/:orgId.json`, with the caller's role |
| Resolve a membership role | `findRole(userId, orgId)` - the `ORGANIZATION_MEMBERSHIP_LOOKUP` implementation |
| Expose a membership | `findMembership(userId, orgId)` - exported for other modules |

Controllers are described in [Endpoints](./endpoints.md). The service holds the business logic;
the controller holds the route definitions and response setup.

## The single-writer rule

`OrganizationService#create` is the **only code that writes memberships**.

- It always writes exactly **one** `owner` row, for the caller.
- It does so in the **same DB transaction** as the organization insert.
- The role is **hard-coded to `owner`** for the creator and never read from input.

The second and third points above are what allow the invariant "every organization has exactly one
owner" to hold **without a database constraint**. There is no partial unique index on
`role = 'owner'` - see [Tables](./tables.md).

**Consequence for anyone adding code:** a new write path to memberships must preserve the
invariant on its own. The database will not catch a violation.

## `create`

Input: the caller's user id and an already-validated name.

Steps, in one transaction:

1. Insert the `Organization` row.
2. Insert the `OrganizationMembership` row: `organization_id` from step 1, `user_id` from the
   caller, `role = 'owner'`.
3. Commit.

Guarantees that follow:

- **Atomicity.** A failure in step 2 rolls back step 1, so an organization can never exist without
  its owner membership.
- **No role from input.** Organization bodies carry only `name`; any other field answers
  `400 VALIDATION_FAILED` before the service is reached.
- **No second member.** There is no code path that adds another membership, which is why every
  organization has exactly one member today.

The caller must be an **approved, authenticated user** - that is enforced by `JwtGuard`, not by
the service.

## `rename`

The only update operation that exists.

- Signature shape: the caller's membership plus the new name.
- **Role check lives here**, not in a decorator: `hasMinRole(membership.role, ADMIN)`.
- **Why here:** the organization routes are **not** owner-scoped, so `OwnerContextGuard` does not
  run on them and `@MinOrgRole` would have no effect. The service is therefore the enforcement
  point. See [Roles -> Enforcement points](./roles.md#enforcement-points).
- A member with a lower role receives the **uniform 403**
  (`{ "error": { "code": "FORBIDDEN", "message": "Forbidden" }, "statusCode": 403, ... }`),
  naming neither the resource nor the required role.
- **Concurrent renames: last write wins.** There is no optimistic locking and no version column.

### Check order on `PATCH /orgs/:orgId.json`

The order is significant and is **not** the service's alone:

| Step | Where | Answer |
|---|---|---|
| 1. Validate the body | DTO / `@StrictBody()` | `400 VALIDATION_FAILED` |
| 2. Resolve `:orgId` and membership | Controller / service | `404` (uniform) |
| 3. Check the role | `OrganizationService.rename` | `403` (uniform) |

- The body is validated **first**, so an invalid body answers `400` even for an unknown or foreign
  organization.
- That `400` depends **only on the body**, so it cannot be used to enumerate organizations.
- The `404` **always** precedes the `403`.

## The `ORGANIZATION_MEMBERSHIP_LOOKUP` port

`OrganizationService` is the adapter behind the port that `core/` depends on.

| Property | Value |
|---|---|
| Port | `ORGANIZATION_MEMBERSHIP_LOOKUP` (`backend/src/core/organization-membership-lookup.ts`) |
| Method | `findRole(userId, orgId)` |
| Returns | The member's `OrgRole`, or `null` - meaning "not a member, or no such organization" |
| Cost | **One lookup** on the unique `(organization_id, user_id)` index |
| Wiring | `AuthModule` provides it with `OrganizationService` via `useExisting` |

### Why the port exists

- **`core/` never imports `auth/`.** The guard, the decorator and every owner-scoped module depend
  on the interface in `core/`, and only `auth` knows the implementation. This is the same pattern
  as `SESSION_LOOKUP`.
- **Other modules read memberships only through this port** (or through the service's own
  `findMembership`), **never by querying the tables**. A module that writes its own SELECT against
  `auth_organization_memberships` is a defect.

### `null` is deliberately ambiguous

`findRole` returning `null` conflates two situations - no such organization, and no membership in
an existing organization - and that is **intentional**. The caller cannot distinguish them, so
neither can an attacker: both produce the same uniform `404`.

### No caching

- The role is **re-read from the DB on every request**.
- No cache layer, no request-scoped memoization, no `is_admin` bypass.
- Consequence: a role changed in the database applies on the **next request**. The frontend
  refreshes its copy on any `403`.

## `findMembership`

- Exported alongside the port implementation.
- Signature: `findMembership(userId, orgId)`.
- Used where the caller needs the **membership row itself** - the rename path needs the role - not
  only the rank.
- Also backed by the unique `(organization_id, user_id)` index.

## What the service does not do

- **It does not define routes.** That is `OrganizationController`.
- **It does not serialize responses.** That is `organization-response.ts` - see
  [Response](./response.md).
- **It does not decide the cache class.** That is declared on the controller.
- **It does not validate the name's syntax.** `OrganizationNameDto` does that before the service
  runs.
- **It does not authenticate.** `JwtGuard` does, and only `approved` users get through.
- **It does not implement joining, leaving, transferring or closing.** None of those exist. See
  [Roadmap](./roadmap.md).

## Wiring

```
AuthModule
  providers: [ ..., OrganizationService, { provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useExisting: OrganizationService } ]
  exports:   [ OrganizationService ]

OrganizationController  --injects-->  OrganizationService
OwnerContextGuard       --injects-->  ORGANIZATION_MEMBERSHIP_LOOKUP  (fulfilled by OrganizationService)
```

- `useExisting` means there is **one instance**, not two: the same object is both the concrete
  service and the port implementation.
- Other modules inject the **port**, never the `auth` service class, so the dependency direction
  stays `module -> core`.

## Rules a reviewer should enforce

From the module's `data-access` checklist, as it applies to this service:

1. Organization routes outside the owner-scoped mechanism **check the role in the service** - as
   `rename` does.
2. Record-dependent rules are checked in the service and **fail closed** - the documented case is
   editing a payment-generated transaction, which needs `admin`.
3. The role **never comes from input**: only from the DB membership, via `findRole`.
4. The **404 comes before any 403**.
5. The **403 body is uniform**, naming neither the resource nor the role.

See [Security](./security.md).

## Failure modes and their answers

| Situation | Where it is caught | Answer |
|---|---|---|
| Unknown, malformed or foreign `:orgId` | `parseOrgId()` / membership lookup | uniform `404` |
| Caller is not a member (global admin included) | membership lookup | uniform `404` |
| Caller is a member with too low a role on rename | `OrganizationService.rename` | uniform `403` |
| Body carries `role` or `organizationId` | `@StrictBody()` / `OrganizationNameDto` | `400 VALIDATION_FAILED` |
| Name empty, over 255 code points, or with control characters | `OrganizationNameDto` | `400 VALIDATION_FAILED` |
| No `access_token`, or a `pending` / `denied` user | `JwtGuard` gate | `401` |

## What is not documented in the repository

The `docs/agents/` pages name this service, state its role, and quote its two write-side method
names and two read-side method names. They do **not** contain:

- the class source: constructor, injected repositories, method signatures and return types;
- the **names of the methods that back `GET /orgs.json` and `GET /orgs/:orgId.json`** - the docs
  only say the controller delegates to the service;
- how the transaction is opened (TypeORM `DataSource.transaction`, a transaction manager, or a
  repository call);
- whether `create` uses the repository's `save` or an explicit `insert`;
- the exact error thrown on the `404` path (`NotFoundException` versus a custom class) and where
  it is constructed;
- whether `rename` re-reads the membership or receives it from the controller.

Read `backend/src/auth/organization.service.ts` for the authoritative version. Nothing on this page
claims to be a transcription of it.
