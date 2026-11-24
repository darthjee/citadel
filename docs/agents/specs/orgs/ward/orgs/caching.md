# Organizations - Caching

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Endpoints](./endpoints.md), [Security](./security.md), [Response](./response.md),
[Owner context](./owner-context.md).

## Summary

Caching on the organization surface is treated as **part of the security contract**, not as an
optimization detail.

| Rule | Detail |
|---|---|
| Controller default | Cache class **`never`** - every organization route sends **`X-Skip-Cache: true`** |
| The two `GET`s | Narrowed to **`user-scoped`** - cached **per caller** |
| Writes | `never`, plus **`Cache-Control: no-store`** |
| An organization id in the URL | Does **not** make a response public |
| Owner-scoped controllers | `@OwnerScopedController()` sets `user-scoped`, inseparably from the scoping |
| Names in cache keys | Never logged |

The organizing idea: **a response that depends on who is calling must be cached per caller, and
a response that depends on who is calling must never be cached for everyone.**

## The two cache classes

### `never`

- Sends `X-Skip-Cache: true` and `Cache-Control: no-store`.
- Used for **every write** route, and as the **controller-level default** for the organization
  controller.
- Consequence: the proxy neither stores nor serves a cached copy.

### `user-scoped`

- Cached **per caller**.
- Used for the **two `GET`** organization routes, and set automatically by
  `@OwnerScopedController()`.
- Consequences: each user has their own cache entry, and the entry is only ever served back to
  the caller who created it.

## Per-route classes

| Method | Path | Cache class | Why |
|---|---|---|---|
| `GET` | `/orgs.json` | `user-scoped` | The result is the caller's membership list - different for every user |
| `POST` | `/orgs.json` | `never` | A write. It also creates a membership |
| `GET` | `/orgs/:orgId.json` | `user-scoped` | Contains the **caller's role**, so it differs per caller even with the same id |
| `PATCH` | `/orgs/:orgId.json` | `never` | A write |

- The controller declares **`never`** at **class level**, so the default is safe: a new route is
  non-cacheable unless someone deliberately narrows it.
- The two `GET`s are then **narrowed** to `user-scoped` one by one.
- The narrowing is **one-directional**: a route may narrow to `never`, but **never** to `public`.

## Why an organization id in the URL does not make a response public

This is the counter-intuitive part, and the most likely place for a mistake.

The intuition: `/orgs/42.json` looks like a stable, path-addressable resource. A cache keyed by
path would appear to be safe.

Why it is wrong - **two independent reasons**:

1. **The response carries the caller's role.** `GET /orgs/:orgId.json` returns
   `{ id, name, role, created_at, updated_at }` where `role` is **the caller's** role, not the
   owner's. Two members of organization 42 receive **different bodies** for the **same path**. A
   path-keyed cache would serve one member's role to another.
2. **Membership is the authorization boundary, not a property of the path.** A non-member gets the
   uniform `404` on the very same path. Caching a successful body by path alone would risk serving
   a member's response to a caller who is not entitled to any response at all.

So the id in the URL buys nothing: the response is **caller-dependent**, and must be cached per
caller.

## Why personal routes must be `user-scoped` - no exception

Personal routes carry **no owner in the URL at all**:

- `/bank/accounts.json`, not `/users/:userId/bank/accounts.json`.
- The only thing that selects the owner is the **authenticated token**.

That has a direct caching consequence: the path is **identical for every user**. A shared cache
keyed by path would return one user's accounts to another. They **must** be `user-scoped`, with
**no exception**.

This is why `@OwnerScopedController(path)` bundles three decisions into one decorator:

1. mounting under `<path>` and `orgs/:orgId/<path>`;
2. adding `@OwnerScoped()`;
3. setting the cache class to `user-scoped`.

The three **cannot be separated**: a controller cannot be mounted under both prefixes while
silently missing the scoping, nor be owner-scoped while declared `public`. See
[Owner context](./owner-context.md).

## The proxy rule that makes this urgent

The proxy is `darthjee/tent`. Its **`default_proxy`** rule:

- caches any **`2xx` `*.json`** response,
- keyed **only by query string**,
- **regardless of HTTP method**.

Two consequences:

1. **A `POST` can be cached.** Because the method is not part of the key, an uncapped write
   response could be stored after the first call and served verbatim to a different caller -
   **credentials included**. This is the documented rationale for the `auth` routes being
   `@CachePolicy(CacheClass.Never)` at controller level.
2. **A path-keyed entry has no caller dimension.** Because only the query string keys the entry,
   and these routes carry no query string, all callers of `/orgs.json` would land on the **same**
   entry.

That is why the organization routes send **`X-Skip-Cache: true` on every route**, writes
included, and why the two `GET`s are explicitly `user-scoped` rather than left to the default rule.

## How the class reaches the proxy

- `@CachePolicy(CacheClass.Never)` is declared on the controller, so the framework sends the
  headers for every route.
- `never` emits **`X-Skip-Cache: true`** and **`Cache-Control: no-store`**.
- `user-scoped` responses rely on the proxy's caller-aware handling; the docs also refer to an
  **`X-Cache-Allow`** header on cached-per-caller routes.
- Every organization route sends **`X-Skip-Cache: true`**, writes included.

## Names are never logged, and never used as keys

- Organization names are **never written to logs**, on any path - create, rename, read.
- They are also not part of a cache key: the key is the route plus the caller, never the content.

## Cache and the security rules together

| Security rule | Caching consequence |
|---|---|
| The role is **re-read from the DB on every request** | The role is **not** cached in application memory. The HTTP cache is per caller and short-lived, but the authorization decision is never served from a role cache |
| The `404` is uniform | A non-member's `404` is not cached for a member, and a member's body is not served to a non-member |
| Minimal responses | The cached body contains only the caller's own relationship - no member list, no other users' ids |
| No `is_admin` bypass | A global admin's request is cached as **that admin's** entry, never as a shared organization entry |
| Names are never logged | The cached body may contain the name, but no log entry does |

## Interaction with the frontend

- The UI's **context switcher** is built on `GET /orgs.json`, so a stale entry would show the
  wrong organization list.
- After a `POST` or `PATCH`, the client must not rely on a cached `GET` - the writes are
  `never`, so the response is fresh, but the earlier list entry may still be cached for that caller.
- On any `403`, the frontend refreshes its copy of the role, which is exactly the case where a
  cached response would be misleading.

## Consequences for a new route

Derived from the rules above. For a new organization route:

1. **Writes are `never`, always.** Never narrow a write to a cacheable class.
2. **Reads that depend on the caller are `user-scoped`.**
3. **Never `public`.** The narrowing is one-directional.
4. **If the controller is owner-scoped, use `@OwnerScopedController(path)`** - do not mount the two
   prefixes by hand and set the class separately.
5. **Send `X-Skip-Cache: true` on every route**, including writes, because the proxy ignores the
   HTTP method.

The failure mode to keep in mind: a `GET` that looks path-stable but returns anything
caller-dependent. On this surface that is **both** `GET`s.

## What is not documented in the repository

The `docs/agents/` pages state the classes, the headers, the per-route assignment and the proxy
rule. They do **not** contain:

- the implementation of `@CachePolicy`, `CacheClass` or the interceptor that sets the headers;
- the exact `X-Cache-Allow` value sent on the two `GET`s;
- the TTL of a `user-scoped` entry;
- how Tent keys a `user-scoped` entry - by cookie, by a derived identity header, or otherwise. The
  docs state that the entry is per caller; the mechanism is in the proxy's own documentation;
- whether invalidation happens on write, or whether a write simply does not populate a cache entry;
- the general caching strategy, which lives in `docs/agents/architecture/caching.md` - a page
  outside this series and not reproduced here;
- the behaviour of `Cache-Control: no-store` versus `X-Skip-Cache` when both are present.

Read `docs/agents/architecture/caching.md` and the Tent documentation for the authoritative version
of the proxy mechanics. Nothing on this page is inferred beyond what the docs state.
