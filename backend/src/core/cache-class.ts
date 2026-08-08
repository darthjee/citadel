/**
 * Explicit cache class every backend route must declare (via `@CachePolicy()`), driving both
 * Tent's shared-cache opt-out header (`X-Skip-Cache`) and the browser-facing `Cache-Control`
 * header. See `docs/agents/architecture/caching.md`.
 */
export enum CacheClass {
  /** Shared-cacheable by Tent; the only class Navi may warm. */
  Public = 'public',
  /** Per-caller data; never shared-cached (until Tent has a per-user cache). */
  UserScoped = 'user-scoped',
  /** Auth, tokens, admin, and operational (health/readiness) responses. */
  Never = 'never',
}

// Tent's `default_proxy` rule (`proxy/*_configuration/rules/backend.php`) caches any 2xx
// response to a `*.json` URL by method-agnostic, query-string-only key unless the response
// carries this header. See `docs/agents/architecture/proxy.md`'s "Cache bypass" section.
export const SKIP_CACHE_HEADER = 'X-Skip-Cache';

// Mirrors Tent's `CacheStalenessMiddleware` `maxAgeSeconds`, so browsers never hold a `public`
// response longer than the proxy considers it fresh.
export const PUBLIC_MAX_AGE_SECONDS = 10;
