# Architecture — API Caching Strategy

This page is the single source of truth for how Citadel Placeholder's API responses are cached. Other docs
(proxy, cache warmer, flow, auth routes) link here rather than restating the rules.

## Default: opt-out shared caching

Tent's backend rule (`proxy/*_configuration/rules/backend.php`) routes every `*.json` URL to
the NestJS backend through `default_proxy`. It **shared-caches every 2xx response by default**:
caching is opt-out, not opt-in.

The Tent cache key is built from the path and query string only. It **ignores the HTTP method**
and the caller (cookies, `Authorization`). A cached `GET /me.json` would be served to every
other caller, and a cached `POST` response could be served for a later `GET` to the same URL.
The only protection is the `X-Skip-Cache` response header: Tent's rule sets
`'skip_cache_header' => 'X-Skip-Cache'`, and any response carrying it bypasses the cache
entirely.

## Cache classes

Every API route belongs to exactly one cache class, declared on the backend with
`@CachePolicy(CacheClass.X)` (`backend/src/core/cache-policy.decorator.ts`). The enum lives in
`backend/src/core/cache-class.ts`. The decorator can be applied at controller level or at route
level; a route-level class overrides the controller's.

| Class | Enum | Use it for | Examples |
|---|---|---|---|
| `public` | `CacheClass.Public` | Data identical for every caller, readable by anyone | Reference data readable by anyone (none exist yet) |
| `user-scoped` | `CacheClass.UserScoped` | Data that depends on who the caller is | A user's own saved resources, once any exist |
| `never` | `CacheClass.Never` | Auth, tokens, admin, and operational endpoints | Every `AuthController`, `AdminController` and `AuthorizationRequestController` route; `GET /health.json`, `GET /ready.json` |

How to pick one:

- If the response differs by caller in any way (session, user id, role), it is **not** `public`.
- Auth, token, and admin endpoints are always `never`.
- Operational endpoints (`health.json`, `ready.json`) are always `never`: they must always reach
  the backend, or a cached health/readiness check could report ok while the backend (or its
  database) is down.
- `user-scoped` stays uncached until Tent supports a per-user cache (see [Future](#future)).
- When in doubt, choose `never`.

**Enforcement:** a backend spec walks every registered controller route and fails when a route
declares no class (`backend/src/core/tests/cache-policy.coverage.spec.ts`).
A new endpoint cannot silently fall into Tent's opt-out default. The `cache` agent also
reviews, read-only, that every endpoint declares a class and that `never`/`user-scoped`
endpoints send `X-Skip-Cache`.

## Response headers

The global `CachePolicyInterceptor` sets the headers **before** the handler runs, so errors
thrown by the handler carry them too. Rejections from global guards (`OriginGuard`, `JwtGuard`,
`AdminGuard`) happen before interceptors and carry no cache headers; that is harmless because
Tent only caches 2xx responses.

| Class | `X-Skip-Cache` | `Cache-Control` |
|---|---|---|
| `public` (GET/HEAD) | *(absent)* | `public, max-age=10` |
| `user-scoped` | `true` | `private, no-store` |
| `never` | `true` | `no-store` |
| any class, method other than GET/HEAD | `true` | `no-store` |
| no class declared | *(absent: Tent's opt-out default)* | *(absent)* |

Because Tent's cache key ignores the method, **any method other than GET/HEAD is always treated
as `never`**, whatever class the route declares. This is enforced in the backend interceptor
rather than with a method matcher in the proxy rule.

`Cache-Control` is browser-facing guidance; Tent itself decides on `X-Skip-Cache` alone. The
last row must never ship: the coverage spec fails first.

## Freshness

Tent's `CacheStalenessMiddleware` (`maxAgeSeconds => 10`) treats entries older than 10 seconds
as stale. A stale entry is **still served**, and a background refresh against the backend is
scheduled (stale-while-revalidate). There is no hard expiry.

The backend's `PUBLIC_MAX_AGE_SECONDS` (`backend/src/core/cache-class.ts`) mirrors this value
for the `public` `Cache-Control: max-age`. Change both together.

## Invalidation

Tent's `CacheCleanupMiddleware` (`clear => ['collection','entity']`) runs on any
POST/PATCH/PUT/DELETE that reaches the backend rule, and clears the matching collection and
entity cache directories for that path. There is no cross-path invalidation map and no manual
purge endpoint.

## Navi warm-up

Only `public` GET endpoints may be added to Navi's warm-up resources (`navi/resources/*.yml`).
`user-scoped` and `never` responses are never stored by Tent, so warming them is pointless, and
warming a user-scoped URL with a real session would be a data leak if it were ever cached.
Warm-up runs after tagged releases only. See [cache-warmer.md](../cache-warmer.md).

## Future

User-scoped responses stay uncached until Tent supports a per-user cache (see
[Flow](../flow.md#per-user-cache-upcoming)). At that point `user-scoped` routes may switch from
`X-Skip-Cache` to the per-user mechanism, and this page must be updated.
