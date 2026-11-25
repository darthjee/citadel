# Organizations - Service

Hub: [Organizations](../orgs.md).

## Summary

`OrganizationService` is the **only** code that reads or writes organization data. Three properties
define it:

| Property | Consequence |
|---|---|
| **Single writer of memberships** | The "exactly one owner" invariant holds without a database constraint |
| **Implements the membership-lookup port** | The core guard can check membership without importing `auth` |
| **Not owner-scoped** | Its four routes do not use `@MinOrgRole()`; the role check lives inside `rename` |

## Public surface

| Method | Called by | Notes |
|---|---|---|
| `create(userId, dto)` | `POST /orgs.json` | Writes the organization **and** the `owner` membership in one transaction |
| `listForUser(userId)` | `GET /orgs.json` | Returns the caller's memberships, ordered by organization `id` |
| `findOne(userId, orgId)` | `GET /orgs/:orgId.json` | Loads through the membership, so a non-member gets the uniform 404 |
| `rename(userId, orgId, dto)` | `PATCH /orgs/:orgId.json` | Loads the membership, checks the role, then updates |
| `findRole(userId, orgId)` | `OwnerContextGuard` via the port | Returns the `OrgRole` or `null` |
| `findMembership(userId, orgId)` | `OwnerContextGuard` via the port | Returns the membership row, for callers needing more than the rank |

The names above are the documented responsibilities. See [Endpoints](./endpoints.md) for the HTTP
contract and [Owner context](./owner-context.md) for how the guard reaches `findRole`.

## `create` - the one place the invariant is decided

```
create(userId, { name }):
  transaction:
    organization = insert(name)                  -> id
    membership   = insert(organization.id,
                          userId,
                          role: 'owner')         -> hard-coded
  return serialize(organization, role: 'owner')
```

Four things this does, in order of importance:

1. **Both rows in one transaction.** A failure leaves no organization without its owner, which is
   what keeps "an organization always has at least one membership" true.
2. **The role is hard-coded to `owner`.** It never comes from the request body. Even if the DTO
   allowed a `role` field, this method would ignore it - and `@StrictBody()` rejects it earlier
   anyway.
3. **The caller becomes the owner.** There is no way to create an organization owned by someone
   else.
4. **No cap, no dedupe.** The same user may create two organizations with the same name.

This method being the **only** writer of memberships is the entire enforcement of "exactly one owner
per organization". See [Roles](./roles.md).

## `listForUser`

Returns the organizations the user belongs to, each with the **caller's** role.

| Property | Detail |
|---|---|
| Order | By organization `id` |
| Pagination | **None** |
| Empty case | `200` with `[]` - not `404` |
| Role field | The user's role in each organization, read from the membership |
| Owner identity | Never included |
| Member list | Never included |

With no way to join, every entry today has `role: 'owner'`. A `user` or `admin` value would come
from #82.

## `findOne`

The load path is what produces the uniform `404`:

```
findOne(userId, orgId):
  membership = findMembership(userId, orgId)   -> null if any of:
                                                   unknown id, non-numeric id,
                                                   foreign id, not a member
  if !membership: raise NotFound
  return serialize(membership.organization, membership.role)
```

There is **no** branch that distinguishes "organization does not exist" from "you are not a member".
The absence of that branch is the security property, not an oversight.

A global admin who is not a member reaches the same `NotFound`. There is no `is_admin` bypass in this
method or anywhere above it.

## `rename` - where the role check lives

This is the method to read when asking "why is the role check here and not in a decorator?".

```
rename(userId, orgId, { name }):
  membership = findMembership(userId, orgId)
  if !membership:                raise NotFound           // 404 first
  if !hasMinRole(membership.role, ADMIN): raise orgRoleForbidden()  // 403 second
  update organization.name, organization.updated_at
  return serialize(organization, membership.role)
```

### Why not `@MinOrgRole()`

`@MinOrgRole()` is read by `OwnerContextGuard`, and `OwnerContextGuard` acts **only** on routes
marked `@OwnerScoped()`. The four organization routes are **not** owner-scoped - they are the
organization surface itself, not a module mounted under an organization.

So the role check has to be done explicitly in the service. It uses the same primitives as the
guard, which is why the `403` body is identical: `hasMinRole()` and `orgRoleForbidden()` are the
same functions the guard calls.

### The order is the contract

| Order | Check | Failure |
|---|---|---|
| 1 | Membership exists | uniform `404` |
| 2 | Role meets `ADMIN` | uniform `403` |

A non-member therefore **never** gets a `403`, and a `403` never reveals that the organization
exists. Reversing those two lines is a security regression, not a style choice.

The full route order adds the body check first: **`400` > `404` > `403`**.

### Last write wins

No version column, no `If-Match`, no optimistic locking. Two concurrent `PATCH` calls leave one of
the two names, chosen by write order. This is documented as an accepted limitation.

## The membership-lookup port

The guard lives in `core/` and must not import `auth/`. So the dependency is inverted through a
port:

```
backend/src/core/organization-membership-lookup.ts
  export const ORGANIZATION_MEMBERSHIP_LOOKUP = Symbol(...)
  export interface OrganizationMembershipLookup {
    findRole(userId: number, orgId: number): Promise<OrgRole | null>
    findMembership(userId: number, orgId: number): Promise<MembershipView | null>
  }
```

`OrganizationService` implements it. The guard injects `ORGANIZATION_MEMBERSHIP_LOOKUP`.

### Why `useExisting` matters

The binding in `AuthModule` must use **`useExisting`**, not `useFactory` and not a second provider
entry:

```
useExisting: OrganizationService
```

- `useExisting` binds the port token to the **existing** service instance.
- `useFactory` would construct a **second** instance, with its own dependencies and state.
- A second provider entry would do the same.

The failure mode with two instances is quiet: the controller and the guard talk to different
objects. Nothing errors. It only becomes visible if the service ever holds request-scoped state or
caches a lookup - at which point the guard and the controller disagree.

### Why the port has two methods

| Method | Why it exists |
|---|---|
| `findRole` | The guard's common path - only the rank is needed for `hasMinRole()` |
| `findMembership` | Callers that need the row itself, not just the rank |

Splitting them keeps the hot path minimal: the role comparison reads a role, not a full entity.

## What the service does not do

| Not done | Where it happens instead |
|---|---|
| Reading the role from input | Never - the role is written by `create` and read from the DB |
| Trusting a cached role | The guard re-reads on every request |
| Filtering by owner | The organization surface addresses by `:orgId`; owner filters are for owner-scoped modules |
| Deciding cache class | `@CachePolicy` on the controller |
| Serializing member lists | The serializer has no such field |
| Deleting organizations | Not built (#83) |
| Removing members | Not built (#82) |

## Transaction boundaries

| Operation | Transaction scope |
|---|---|
| `create` | The organization insert **and** the membership insert |
| `rename` | A single row update - no multi-row invariant at risk |

`create` is the only method where a partial failure would break an invariant. If the membership
insert failed outside the transaction, the organization would exist with zero members and be
unreachable by anyone.

## Consequences for a change

| Change | What must be preserved |
|---|---|
| Add a membership writer (invite, join) | The "exactly one owner" rule, inside the new writer's own transaction. Nothing in the schema will catch a violation |
| Add a route under an organization | Mark it `@OwnerScoped()` and use `@MinOrgRole()` - do **not** replicate the manual check from `rename` |
| Change the role minimum | Update the service check, the documented capability table, and the frontend `ACTIONS` together |
| Add a response field | `organization-response.ts` is an allowlist - a new column is not automatically public |

The second row is the one most likely to be got wrong: `rename` is a template for the organization
surface, not for owner-scoped modules. Modules take the decorator path.

## What is not documented in the repository

The project documentation states the single-writer rule, the `useExisting` binding, the role check
in `rename`, and the membership port. It does **not** contain:

- the **source** of `OrganizationService`, nor its exact method signatures beyond the port;
- whether `create` uses an explicit `QueryRunner` transaction or a repository-level one;
- whether `listForUser` joins in SQL or loads memberships and then their organizations;
- the shape of `MembershipView` returned by `findMembership`;
- whether `findOne` and `rename` share a private loader, or each call `findMembership` separately;
- any error handling for a duplicate membership - impossible today, since `create` is the only
  writer and always writes one row;
- whether the service caches anything per request.

Read `backend/src/auth/organization.service.ts` and `backend/src/auth/auth.module.ts` for the
authoritative version. Nothing on this page is inferred beyond what the docs state.
