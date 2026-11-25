# Organizations - Owner Context

Hub: [Organizations](../orgs.md).

## Summary

Every request has exactly **one owner**: a user or an organization. Resolving it, guarding it and
filtering by it are all handled in **one place**, so no domain module writes that logic itself.

| Piece | Location | Role |
|---|---|---|
| `OwnerContextGuard` | `backend/src/core/owner-context.guard.ts` | Global `APP_GUARD` - resolves the owner and enforces the minimum role |
| `OwnerContext` | `backend/src/core/owner-context.ts` | The resolved union: `{ kind: 'user' }` or `{ kind: 'organization', organizationId, role }` |
| `OwnerScope` | Same file | The union **without** `role` |
| `ownerWhere()` | Same file | Owner filter for TypeORM `where` objects |
| `ownerSqlWhere(scope, alias)` | Same file | Owner filter for raw SQL |
| `@OwnerScoped()` | `backend/src/core/owner-scoped.decorator.ts` | Marks a route as owner-scoped |
| `@OwnerScopedController(path)` | Same file | Marks a whole controller and mounts it under both prefixes |
| `@CurrentOwner()` | `backend/src/core/current-owner.decorator.ts` | Injects the resolved context |
| `@MinOrgRole(role)` | `backend/src/core/min-org-role.decorator.ts` | Declares the route's minimum role |
| `ORGANIZATION_MEMBERSHIP_LOOKUP` | `backend/src/core/organization-membership-lookup.ts` | The port the guard uses to read membership |
| `parseOrgId()` | `backend/src/core/parse-org-id.ts` | Parses `:orgId` from a raw string |

## Why this exists

Without a shared mechanism, every owner-scoped module would answer three questions in its own way:

1. **Who owns this request?** The JWT user, or the organization in the URL?
2. **Is the caller allowed here at all?** Membership, and how is it checked?
3. **Which rows may be returned?** The owner filter, applied to every query.

Answering those in `bank`, then again in the next module, duplicates a security decision. One module
would get it subtly wrong - a missing filter, a role checked in the wrong order - and nothing would
catch it.

The owner-context mechanism answers all three once.

## The layering rule

This is the design constraint that shapes everything else.

**`core/` never imports `auth/`.**

| Layer | Knows about | Does not know about |
|---|---|---|
| `core/` | HTTP, guards, decorators, the owner-context types, the port interfaces | `Organization`, `OrganizationMembership`, `User`, any auth entity |
| `auth/` | Everything in `core/`, plus its own entities and services | - |
| Domain modules (`bank`) | `core/` and their own entities | `auth/` internals |

The dependency is inverted through ports:

- `ORGANIZATION_MEMBERSHIP_LOOKUP` - the guard asks "what is this user's role in this organization?"
  without knowing there is a membership table.
- `SESSION_LOOKUP` - `JwtGuard` asks "which user owns this session?" without knowing there is a
  session table.

`OrganizationService` implements the membership port, and `AuthModule` binds it with `useExisting`.
See [Service](./service.md).

Consequence for a reader: **the guard has no idea what an organization is.** It knows an `:orgId`
integer and a role, both obtained through the port.

## The flow

```
request
  |
  v
JwtGuard (global)
  |  - reads the access_token cookie
  |  - verifies signature and expiry
  |  - validates sid / sub claims
  |  - loads request.user from the session via SESSION_LOOKUP
  |  - 401 if any step fails
  v
OwnerContextGuard (global)
  |  - if the route has no @OwnerScoped(): pass through untouched
  |  - if :orgId present in the URL:
  |       parseOrgId()          -> 404 on a malformed id
  |       lookup.findRole()     -> 404 when null (unknown, foreign, or non-member)
  |       @MinOrgRole check     -> 403 when the rank is too low
  |       context = { kind: 'organization', organizationId, role }
  |  - otherwise:
  |       context = { kind: 'user', userId: request.user.id }
  |  - stores the context on the request
  v
handler
     - receives it through @CurrentOwner()
     - filters through ownerWhere() / ownerSqlWhere()
```

Two global guards, in this order. `JwtGuard` must run first: the owner cannot be resolved before
the caller is known.

## The two contexts

| Context | `kind` | Contains | Owner is |
|---|---|---|---|
| Personal | `'user'` | `userId` | The JWT user |
| Organization | `'organization'` | `organizationId`, `role` | The organization |

`OwnerContext` carries `role`; `OwnerScope` does not. The distinction matters for callers that derive
the owner from a **record** rather than from the request - they need the owner identity, not the
caller's rank.

### The personal context counts as `owner`

`ownerRole(ctx)` returns **`owner`** for `{ kind: 'user' }`.

That single decision removes personal special-casing from the permission code: `hasMinRole()` and the
frontend `can()` treat a user acting on their own data exactly like an organization owner.

## `:orgId` parsing

`parseOrgId()` receives the raw route segment as a **string**:

| Input | Result |
|---|---|
| `'7'` | `7` |
| `'0'` | rejected |
| `'007'` | rejected by the pattern |
| `'abc'` | rejected |
| `'1e3'` | rejected - **not** coerced to `1000` |
| `'1.5'` | rejected |
| `''` | rejected |
| above `2147483647` | rejected |

The raw-string signature is the point. A parser receiving a number would have already coerced `1e3`
to `1000` and resolved a different organization.

Every rejection answers the **uniform `404`** - a malformed id is not distinguishable from an unknown
one.

The frontend mirrors this with `^[1-9][0-9]*$` and the same `2147483647` bound, resolving to
`not-found` **without issuing a request**.

## The check order is the contract

```
1. Route has @OwnerScoped()?          no -> pass through, no cost
2. :orgId parses?                     no -> 404
3. Membership exists?                 no -> 404     <- non-member
4. Role meets @MinOrgRole?            no -> 403     <- member, too low
5. Attach the context, continue
```

**The `404` check comes before the `403` check.** Consequences:

- A non-member never receives a `403`, so a `403` never reveals that the organization exists.
- The `403` body names neither the resource nor the required role.
- A malformed id never reaches a role comparison at all.

Reordering steps 3 and 4 turns the endpoint into an existence oracle.

## Owner filters

Two builders, because the query styles differ.

### `ownerWhere(scope)`

Returns an object for TypeORM's `where`:

```
user scope:         { userId: <id> }
organization scope: { organizationId: <id> }
```

Used in repository calls: `repo.find({ where: ownerWhere(scope) })`.

### `ownerSqlWhere(scope, alias)`

Returns a SQL fragment plus its parameters, bound to a table alias:

```
user scope:         `${alias}.user_id = ?`
organization scope: `${alias}.organization_id = ?`
```

Used in raw SQL, such as the ledger aggregations. The alias is a parameter because a query may join
several owner-rooted tables.

Both exist so that the filter is **never written by hand** in a module. A hand-written filter is
where the "forgot the organization case" bug lives.

### Child records

Child tables store **no owner copy**. They inherit the owner through their root, so the filter is
applied to the root and reaches children by join.

That is what makes moving a record between owners feasible: only the root row changes.

## `@OwnerScopedController(path)`

One decorator that bundles three decisions that must not drift apart:

1. Mount the controller under `<path>` **and** `orgs/:orgId/<path>`.
2. Add `@OwnerScoped()` so the guard acts.
3. Set the cache class to **`user-scoped`**.

The three are inseparable by design. A controller cannot be mounted under both prefixes while
silently missing the scoping, and cannot be owner-scoped while declared `public`.

Consequence: the cache class of an owner-scoped controller is not a free choice. See
[Caching](./caching.md).

## What the guard does not do

| Not done | Why |
|---|---|
| Import `auth` | The layering rule. Membership is read through the port |
| Cache the role | It is re-read per request - a role change applies on the next request |
| Trust a role from input | The role is never read from a body, query or header |
| Bypass for a global admin | There is no `is_admin` path in the owner check |
| Distinguish "unknown" from "not a member" | Both are the uniform 404 |

## Consequences for a new module

| Step | Detail |
|---|---|
| 1 | Declare the ownership kind. User-owned modules skip this whole mechanism |
| 2 | Write the owner columns (`user_id`, `organization_id`), both nullable, with the check constraint |
| 3 | Implement the repository queries through `ownerWhere()` / `ownerSqlWhere()` |
| 4 | Mount the controller with `@OwnerScopedController(path)` - do not hand-mount the two prefixes |
| 5 | Declare `@MinOrgRole(role)` on every write route |
| 6 | Read the context with `@CurrentOwner()`; never reconstruct it from the request |

The failure mode to keep in mind: a query that looks correct but omits the filter. It passes review,
passes the structural spec, and returns another owner's rows. See [Tests](./tests.md).

## What is not documented in the repository

The project documentation states the guard, its position in the chain, the two contexts, the
decorators, the port, the filter builders and the check order. It does **not** contain:

- the **source** of `owner-context.guard.ts`, `owner-context.ts` or the decorators;
- where exactly the context is stored on the request (a property, a `Symbol` key, a WeakMap);
- the `MembershipView` shape returned by the port;
- whether `ownerSqlWhere` returns a parameterised fragment, a query builder clause, or both;
- the exact behaviour when `@OwnerScoped()` is combined with `@Public()` - the coverage spec treats
  the combination as a failure, the runtime behaviour is not described;
- how `parseOrgId()` distinguishes `0` from a negative number in its error type, since both answer
  the same 404;
- whether the guard runs before or after any other interceptor beyond `JwtGuard`.

Read `backend/src/core/` for the authoritative version. Nothing on this page is inferred beyond what
the docs state.
