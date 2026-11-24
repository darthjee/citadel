# Organizations - Owner Context

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Roles](./roles.md), [Service](./service.md), [Security](./security.md),
[Glossary](./glossary.md).

## Summary

The owner-context mechanism resolves **which owner the current request works for** - a plain user
or an organization - in **one place**, before any handler body runs, so the check cannot be
forgotten route by route.

Six pieces, all in `backend/src/core/`:

| Piece | File | Role |
|---|---|---|
| `OwnerContextGuard` | `owner-context.guard.ts` | Global `APP_GUARD` that resolves the owner and stores it on the request |
| `ownerWhere()` / `ownerSqlWhere()` | `owner-context.ts` | Build the owner filter for TypeORM `where` objects and for raw SQL |
| `parseOrgId()` | `parse-org-id.ts` | Strict parser for `:orgId`; a raw string, so `1e3` never becomes `1000` |
| `@OwnerScoped()` | `owner-scoped.decorator.ts` | Route metadata that turns the guard on for that route |
| `@OwnerScopedController(path)` | `owner-scoped.decorator.ts` | Mounts a controller under both prefixes and sets the cache class, inseparably |
| `@CurrentOwner()` | `current-owner.decorator.ts` | Injects the resolved `OwnerContext` into the handler |
| `@MinOrgRole(role)` | `min-org-role.decorator.ts` | Declares a route's minimum role; read by the guard |
| `ORGANIZATION_MEMBERSHIP_LOOKUP` | `organization-membership-lookup.ts` | The port the guard depends on, so `core/` never imports `auth/` |
| `OrgRole` / `hasMinRole()` / `orgRoleForbidden()` | `org-role.ts` | The roles, the ranking comparison and the uniform 403 |

Everything above lives in `core/`, **not** in `auth/`. That placement is the design.

## Why the mechanism exists

Without it, every owner-scoped route would need its own membership check, and every new route
would be one forgotten `if` away from leaking another user's data. Two properties make that
failure mode cheap to introduce:

- The owner can arrive from **three** different places - the JWT, the URL, or the body - and only
  two of them are legitimate.
- The filter must be applied to **every** query, including raw SQL that TypeORM `where` objects
  do not reach.

The guard removes the first problem by resolving the owner once; `ownerWhere()` and
`ownerSqlWhere()` remove the second by giving both query styles one builder.

## The resolved value

`request.ownerContext` holds a discriminated union:

```
{ kind: 'user',         userId }
{ kind: 'organization', organizationId, role }
```

- `role` is present **only** in the organization variant, and comes from the DB membership.
- The union **without** `role` is called `OwnerScope`, and is also used for owners **derived from a
  record** rather than from the request.
- `ownerRole(ctx)` returns the organization role, or **`owner` for the personal context**. This is
  the bridge to the role system - see [Roles](./roles.md).

Services receive **only** this context, never a raw id. A service method that takes a bare
`organizationId` or `userId` re-opens the hole the guard closed.

## Request pipeline

Order matters, and the docs state it explicitly.

```
1. JwtGuard            - authenticated, approved user (or the gate 401)
2. OwnerContextGuard   - global APP_GUARD, registered AFTER JwtGuard
   a. route has no @OwnerScoped()  ->  do nothing, done
   b. personal prefix (no :orgId)  ->  owner = JWT user
   c. organization prefix          ->  parseOrgId() + membership lookup
   d. store request.ownerContext
   e. read @MinOrgRole (handler first, then class)
   f. role too low                 ->  uniform 403
3. Handler             - @CurrentOwner(), @StrictBody()
```

Two consequences of that order:

- **The 404 always precedes the 403.** Steps c and f are in that sequence, so a non-member never
  reaches the role comparison. A 403 therefore never reveals that an organization exists.
- **The guard is global but inert.** `APP_GUARD` registration means it runs everywhere; the
  `@OwnerScoped()` metadata decides whether it does anything. There is no per-route registration
  to forget.

## Personal prefix

Led by the rule: **the owner is the JWT user, never the URL or the body.**

- The personal route set carries **no owner in the URL** - `/bank/accounts.json`, not
  `/users/:userId/bank/accounts.json`.
- Because there is no owner segment to tamper with, another user's personal data cannot be
  addressed at all. The only thing that selects the owner is the authenticated token.
- Personal routes therefore **must** be `user-scoped` in the cache, with no exception: a shared
  cache would leak one user's data to another, since the response has no owner in the URL to key
  on. See [Caching](./caching.md).

## Organization prefix

Led by the opposite rule: **`:orgId` is untrusted input, and membership is re-checked every time.**

- `:orgId` is taken as a **raw string** and parsed by `parseOrgId()`. A raw string is deliberate:
  with `parseInt` or a numeric coercion, `1e3` would become `1000`, and the guard would resolve a
  different organization than the one written in the path.
- The membership is checked on **every** request, with **no caching** and **no admin bypass**.
- **Every** failure throws the **same uniform 404**: missing user, malformed id, unknown id, and
  non-member - a global admin included. The caller cannot tell the cases apart, so an attacker
  cannot enumerate organizations.

The full response bodies are in [Security](./security.md).

## `OwnerContextGuard`

| Property | Value |
|---|---|
| File | `backend/src/core/owner-context.guard.ts` |
| Registration | Global `APP_GUARD`, **after** `JwtGuard` |
| Activated by | `@OwnerScoped()` metadata - on the route, or on the controller via `@OwnerScopedController()` |
| Does without the metadata | **Nothing.** It returns immediately |
| Writes | `request.ownerContext` |
| Then reads | `@MinOrgRole`, **handler first, then class** |
| Throws | uniform `404` (resolution) then uniform `403` (role) |
| Caches the role | **No**, never |

### What it does not do

- It does **not** read the cache policy - that is declared on the controller.
- It does **not** validate the body - `@StrictBody()` does.
- It does **not** decide which records exist - it only resolves the owner scope; the query
  builders apply the filter.
- It does **not** grant the global `is_admin` any organization role.

## `@OwnerScopedController(path)`

The decorator that makes mounting, scoping and cache class a single decision.

- Mounts the controller under **both** `<path>` and `orgs/:orgId/<path>`.
- Adds `@OwnerScoped()` to it.
- Sets the cache class to **`user-scoped`**.

The three are bundled **so they cannot be separated**: a controller cannot be mounted under the
organization prefix while silently missing the scoping, nor be owner-scoped while declared
`public`.

> A route may narrow the cache class to `never` - but **never** to `public`.

## `@CurrentOwner()`

- Injects the resolved `OwnerContext` into the handler.
- Handlers pass it to the service; the service never receives a raw id.
- The handler does not re-resolve, re-parse or re-check: by the time it runs, the guard has
  already done all three.

## `ownerWhere()` and `ownerSqlWhere()`

The two builders that make the filter impossible to skip in either query style.

| Helper | Target | Why it is needed |
|---|---|---|
| `ownerWhere(scope)` | TypeORM `where` objects | The standard path for repository queries |
| `ownerSqlWhere(scope, alias)` | raw SQL | Raw SQL bypasses TypeORM's `where`, so the filter has to be built into the statement - the `alias` binds it to a table alias |

- Both take an **`OwnerScope`** - the union **without** `role` - so they also accept owners derived
  from a record, not only from the request.
- The `data-access` checklist makes this a review rule: **every query is filtered through the
  `OwnerContext` resolved by `OwnerContextGuard`** (`ownerWhere()` / `ownerSqlWhere()`), and
  **personal queries use only the JWT user as owner**.

## `ORGANIZATION_MEMBERSHIP_LOOKUP`

The port that keeps the dependency arrow pointing one way.

| Property | Value |
|---|---|
| File | `backend/src/core/organization-membership-lookup.ts` |
| Method | `findRole(userId, orgId)` |
| Returns | the member's `OrgRole`, or `null` |
| Cost | **one** lookup, on the unique `(organization_id, user_id)` index |
| Provided by | `AuthModule`, with `OrganizationService` via **`useExisting`** |

- `null` conflates "no such organization" and "not a member", **deliberately**: the caller cannot
  distinguish them, so neither can an attacker. Both become the same 404.
- **Other modules read memberships only through this port**, never by querying the `auth_` tables.
- `useExisting` means **one instance**: the same object is both the concrete service and the port
  implementation. See [Service](./service.md).

The same pattern as `SESSION_LOOKUP`. `core/` depends on the interface; only `auth` knows the
implementation.

## `parseOrgId()`

- File: `backend/src/core/parse-org-id.ts`.
- Input: the `:orgId` path segment **as a raw string**.
- Purpose: reject anything that is not a plain integer id, so a value such as `1e3` can never be
  coerced into `1000` and resolve a different organization than the one in the URL.
- Every rejection joins the uniform 404 - the parser's failures are indistinguishable from a
  non-member's.

## `@StrictBody()`

Not part of the owner resolution, but part of the same contract, because it closes the **body** as
an owner source.

- File: `backend/src/core/strict-validation.pipe.ts`.
- Every handler takes its body through it, so **unknown fields - owner fields included - answer
  `400`**.
- This is what makes "no client-supplied owner or role" true at the transport layer:
  `organizationId`, `userId` and `role` in a body are rejected before any service code runs.
- Organization bodies accept **only** `name`. Any other field answers `400 VALIDATION_FAILED`.

## The dependency rule: `core/` never imports `auth/`

The reason every piece above lives in `core/` and not in `auth/`:

- `OwnerContextGuard` is a **global** guard. If it imported `auth/`, every module using an
  owner-scoped route would inherit a dependency on `auth`.
- `OrgRole` is used by the guard, the decorator and every owner-scoped module. Putting it in
  `core/` lets all of them use it without importing `auth`.
- `auth`'s `MembershipRole` **re-exports** `OrgRole`. Same type, two import paths, **one
  definition**.
- The membership lookup crosses the boundary through a **port**, injected at runtime.

The arrow therefore points one way only:

```
auth  ---imports--->  core
core  --uses port-->  ORGANIZATION_MEMBERSHIP_LOOKUP  (implemented by auth, injected at runtime)
modules  ---imports--->  core
```

A `core/` file importing from `auth/` breaks the rule that makes the guard usable platform-wide.

## Failure answers, in order

| Step | Situation | Answer |
|---|---|---|
| `JwtGuard` | no `access_token`, bad signature, expired or revoked session, `pending` / `denied` user | `401` (single uniform body) |
| `OwnerContextGuard` | missing user, malformed `:orgId`, unknown `:orgId`, not a member - global admin included | uniform `404` |
| `OwnerContextGuard` | member whose role is below `@MinOrgRole` | uniform `403` |
| `@StrictBody()` | unknown field in the body, `role` and owner fields included | `400 VALIDATION_FAILED` |

- The **404 comes before any 403**, always.
- The 403 body names neither the resource nor the required role.
- There is **no `is_admin` bypass** at any step.

## Checklist for adding a new owner-scoped route

Derived from the module's rules; useful as a review checklist.

1. Mount the controller with **`@OwnerScopedController(path)`** - never mount the two prefixes by
   hand.
2. Declare the minimum role with **`@MinOrgRole(role)`** if the route writes.
3. Take the owner from **`@CurrentOwner()`**, never from the URL beyond `:orgId` and never from the
   body.
4. Take the body through **`@StrictBody()`**, and make the DTO accept no owner field.
5. Filter every query with **`ownerWhere()`** or **`ownerSqlWhere()`** - including raw SQL.
6. Pass the **`OwnerContext`** to the service, never a raw id.
7. Do not add a role to the input, a cache layer over the role, or an `is_admin` bypass.
8. Keep the cache class at `user-scoped` or narrow it to `never` - **never `public`**.

## Coverage spec

The mechanism is guarded by a **coverage spec** that fails the build on the two ways a route can
opt out of it:

- a handler taking a plain **`@Body()`** instead of `@StrictBody()`;
- an owner-scoped route declared **`public`**.

See [Tests](./tests.md) for the rest of the review surface.

## What is not documented in the repository

The `docs/agents/` pages name every file in this mechanism, state its role and describe the
pipeline order. They do **not** contain:

- the source of `owner-context.guard.ts`, `owner-context.ts`, `parse-org-id.ts`,
  `owner-scoped.decorator.ts`, `current-owner.decorator.ts`, `min-org-role.decorator.ts`,
  `organization-membership-lookup.ts` or `org-role.ts`;
- the file that **declares the `OwnerContext` and `OwnerScope` types** - the docs give the union
  shape and attribute the filter helpers to `owner-context.ts`, but do not state where the types
  themselves are declared;
- the implementation of `parseOrgId()`: its accepted format, its return type, and the error it
  throws on rejection;
- whether `@OwnerScoped()` carries arguments;
- how `request.ownerContext` is typed on the Express request object;
- the ordering guarantees between `@StrictBody()` and the guard;
- the full text of the coverage spec, which the docs reference without quoting.

Read the files under `backend/src/core/` for the authoritative version. Nothing on this page
claims to be a transcription of them.
