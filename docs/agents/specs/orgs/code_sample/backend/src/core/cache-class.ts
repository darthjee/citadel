/**
 * Explicit cache class every backend route must declare (via `@CachePolicy()`), driving Tent's
 * cache opt-in/opt-out headers (`X-Cache-Allow`/`X-Skip-Cache`) and the browser-facing
 * `Cache-Control` header. See `docs/agents/architecture/caching.md`.
 */
export enum CacheClass {
  /** Shared-cacheable by Tent; the only class Navi may warm. */
  Public = 'public',
  /** Per-caller data; cached per caller by the proxy (keyed on the access token), never warmed. */
  UserScoped = 'user-scoped',
  /** Auth, tokens, admin, and operational (health/readiness) responses. */
  Never = 'never',
}

// Tent's `default_proxy` rule (`proxy/*_configuration/rules/backend.php`) only caches a 2xx
// `*.json` response that carries this header (`require_cache_header`). Sent for `public` and
// `user-scoped` GET/HEAD; the proxy keys each entry per caller (access token + query).
export const CACHE_ALLOW_HEADER = 'X-Cache-Allow';

// Explicit opt-out for Tent: a response carrying it is never stored, and it wins over
// `X-Cache-Allow`. Sent for `never` routes and for every method other than GET/HEAD, since
// Tent's cache key ignores the HTTP method. See `docs/agents/architecture/proxy.md`'s
// "Cache bypass" section.
export const SKIP_CACHE_HEADER = 'X-Skip-Cache';

// Mirrors Tent's `CacheStalenessMiddleware` `maxAgeSeconds`, so browsers never hold a `public`
// response longer than the proxy considers it fresh.
export const PUBLIC_MAX_AGE_SECONDS = 10;
