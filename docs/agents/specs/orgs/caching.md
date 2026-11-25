# Organizations - Caching

Hub: [Organizations](README.md).

## Summary

Three cache classes, declared once per controller, enforced by the **proxy** rather than by the
backend.

| Class | Keyed by | May the proxy store it |
|---|---|---|
| `never` | - | **No.** Writes and anything that must not be served stale |
| `user-scoped` | The caller | Yes, per caller only |
| `public` | Nothing - same for everyone | Yes, shared |

For organizations:

| Route | Class |
|---|---|
| `GET /orgs.json` | `user-scoped` |
| `GET /orgs/:orgId.json` | `user-scoped` |
| `POST /orgs.json` | `never` |
| `PATCH /orgs/:orgId.json` | `never` |

**Neither `GET` is ever `public`**, because their bodies depend on who is asking.

## Why the backend declares and the proxy enforces

The backend does not store responses. It **tells the proxy** what it may do.

| Piece | File | Role |
|---|---|---|
| `CacheClass` | `backend/src/core/cache-class.ts` | The enum: `Never`, `UserScoped`, `Public` |
| `@CachePolicy(CacheClass)` | `backend/src/core/cache-policy.decorator.ts` | Declares the class on a controller or route |
| `CachePolicyInterceptor` | `backend/src/core/cache-policy.interceptor.ts` | Emits the headers the proxy reads |
| `@CacheInvalidation()` | `backend/src/core/cache-invalidation.decorator.ts` | Marks a write route as invalidating |
| `CacheInvalidationInterceptor` | `backend/src/core/cache-invalidation.interceptor.ts` | Performs the invalidation |
| `CacheTokenService` | `backend/src/core/cache-token.service.ts` | The per-caller token behind `user-scoped` |

The important consequence: **a wrong cache class is not a backend bug that a backend test catches.**
The backend emits headers; the proxy obeys them. The failure appears as another user's data served
from cache.

## The three classes

### `never`

- Nothing may be stored.
- Emitted on writes and on anything that must not be served stale.
- `POST /orgs.json` and `PATCH /orgs/:orgId.json` are both `never`.

### `user-scoped`

- The response may be stored, but **only per caller**.
- Two callers requesting the same URL must not share the entry.
- Requires a per-caller key - `CacheTokenService` provides it.
- Both organization `GET`s are `user-scoped`.

### `public`

- The same response for everyone, storable and shareable.
- **No organization route is `public`.**

## Why the organization `GET`s cannot be public

The proof is the response shape, not a policy preference.

`GET /orgs/:orgId.json` returns `role` - **the caller's role in that organization**.

| Caller | Same URL | Body |
|---|---|---|
| The `owner` | `/orgs/1.json` | `role: "owner"` |
| An `admin` | `/orgs/1.json` | `role: "admin"` |
| A `user` | `/orgs/1.json` | `role: "user"` |

Same URL, three different bodies. If the proxy stored that as `public`, the second caller would
receive the first caller's role.

`GET /orgs.json` has the same property in a different form: the array is the **caller's**
organizations. A `public` cache would serve another user's list - which is both a wrong answer and a
disclosure of organization names and ids the caller does not belong to.

That is why an id in the URL is **not** what makes a response cacheable. The relevant question is
whether the body depends on the caller, and here it always does.

## The bundling in `@OwnerScopedController()`

For modules - not for the organization surface - one decorator sets three things that must not drift
apart:

1. Mount under both prefixes: `<path>` and `orgs/:orgId/<path>`.
2. Add `@OwnerScoped()`, so `OwnerContextGuard` acts.
3. Set the cache class to **`user-scoped`**.

```ts
@OwnerScopedController('bank/accounts')
```

The three are inseparable by design:

- A controller mounted under both prefixes cannot silently miss the scoping.
- An owner-scoped controller cannot be declared `public`.

So for an owner-scoped module, **the cache class is not a free choice**. It follows from the
scoping. A controller may narrow it to `never` - for a route whose response must never be stored -
but **never** to `public`.

The organization controller is **not** owner-scoped, so it declares `@CachePolicy` explicitly on its
routes. See [Owner context](./owner-context.md).

## Invalidation on write

A write must not leave a stale `GET` behind.

| Decorator | Declared on | Effect |
|---|---|---|
| `@CacheInvalidation()` | The write route | Invalidates the related cached responses |
| `organization-invalidation.ts` | `backend/src/auth/` | The organization-specific invalidation logic |

Which routes:

| Route | Invalidates |
|---|---|
| `POST /orgs.json` | The caller's `GET /orgs.json` |
| `PATCH /orgs/:orgId.json` | `GET /orgs/:orgId.json` and the caller's `GET /orgs.json` |

`PATCH` must invalidate the list too: `name` appears there, so a stale list would show the old name.

Both writes are `never` for **storage**, and separately carry invalidation. Those are two different
decisions: `never` means "do not store this response", invalidation means "drop what you stored
because it is now wrong".

## What invalidates a role change

A subtle case, and the reason the frontend has its own path.

If a user's role changes in the database, the cached `GET /orgs.json` may still show the old role.

| Layer | Behaviour |
|---|---|
| Backend | Reads the role fresh on **every** request - no server-side cache |
| Proxy | Serves the cached `user-scoped` response until invalidated |
| Frontend | On any `403`, `ApiClient` emits `permission:forbidden`; `forbiddenRefreshEffect` refetches the list once per burst |

So the recovery path for a stale role is the **`403` itself**: the user tries a control, the backend
refuses, the frontend refreshes, the controls update. See [Frontend](./frontend.md).

There is no push and no TTL-based refresh documented in the frontend for this. The `403` is the
signal.

## Cache headers

| Header | Emitted by | Meaning |
|---|---|---|
| `X-Skip-Cache` | `CachePolicyInterceptor` | Instructs the proxy not to store this response |
| `Cache-Control` | `CachePolicyInterceptor` | The standard directive the proxy reads |
| Per-caller token | `CacheTokenService` | Part of the key that makes `user-scoped` work |

The exact header values are not documented. See the final section.

## Rules when adding a route

| Route kind | Cache class |
|---|---|
| Owner-scoped module read | Comes from `@OwnerScopedController()` - `user-scoped` |
| Owner-scoped module write | Comes from the decorator; narrow to `never` if needed |
| Organization-surface read | Inherently `user-scoped`. Declare `@CachePolicy(CacheClass.UserScoped)` |
| Organization-surface write | `never`, plus `@CacheInvalidation()` |
| Anything whose body depends on the caller | **`user-scoped`, never `public`** |

The last row is the rule to apply when the others do not obviously fit: if the response would differ
between two logged-in users at the same URL, it cannot be `public`.

## What caching does not protect

| Not covered | Why |
|---|---|
| A role changed mid-session reaching the UI immediately | The `403` path is what refreshes it |
| A revoked membership | The next request answers `404`; the cached list may still name the organization |
| Rate limiting | Unrelated (#84) |
| Authorization | Caching is a **performance** layer. Every decision is re-made by the backend on every request |

That last row is the one to keep in mind: a cached response never bypasses `OwnerContextGuard`,
because the guard runs on the request that produces the response. A cache hit only means the
response was already computed for **that same caller**.

## What is not documented in the repository

The project documentation states the three cache classes, the proxy's role, the invalidation
decorator, the bundling inside `@OwnerScopedController()` and the rule that an owner-scoped route is
never `public`. It does **not** contain:

- the concrete `X-Skip-Cache` and `Cache-Control` header values for each class;
- how the proxy builds the `user-scoped` key, and whether `CacheTokenService` supplies a hash, a
  session id or the user id;
- the TTL of a `user-scoped` entry;
- the exact invalidation mechanism - pattern purge, tag-based, or per-URL;
- the source of `organization-invalidation.ts`;
- whether the invalidation is synchronous with the write or deferred;
- whether a `public` cache class on an owner-scoped route is separately asserted by the coverage
  spec - the documented triggers are a plain `@Body()` and a `public` **route**, not a cache class;
- any cache warm-up or pre-population.

Read `backend/src/core/cache-*.ts`, `backend/src/auth/organization-invalidation.ts` and
`docs/agents/architecture/caching.md` for the authoritative version. Nothing on this page is inferred
beyond what the docs state.
