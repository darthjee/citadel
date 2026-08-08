# Architecture — Proxy

Tent (`darthjee/tent`) is the single entry point on port 3000 in both dev and prod. It's a
small PHP reverse proxy/static file server, entirely backend-language-agnostic — it just
proxies to `http://backend:8080` and `http://frontend:8080` by container link alias (dev) or a
host-specific `$backendHost`/`$staticRoot` pair (prod). See
[How to Use Tent](../external/how-to-use-tent.md) for the full rule/middleware/cache reference —
this page only covers how Citadel Placeholder configures it.

## Rule loading order

`configure.php` requires rule files in order — order matters, later rules act as catch-alls:

1. `rules/frontend.php` — dev: proxies to Vite (HMR); prod: serves static `dist/` output
2. `rules/backend.php` — routes every `*.json`-suffixed URL to the NestJS backend, with cache
   middlewares (`SetClientIpMiddleware`, `CacheCleanupMiddleware`, `CacheStalenessMiddleware`)
3. `rules/redirects.php` — catch-all: `GET /path → /#/path` (302) — **must stay last**

There is no `rules/admin.php` — Citadel Placeholder has no admin UI (see `docs/agents/product.md`).

## Dev vs. prod configuration

`proxy/dev_configuration/` and `proxy/prod_configuration/` mirror the same rule shape, but
differ in where hosts/paths come from:

- **Dev** (`locals.php`): `$cacheFolder` only — hosts are hardcoded container link aliases
  (`http://backend:8080`, `http://frontend:8080`).
- **Prod** (`locals.php.sample`, real `locals.php` gitignored on the actual host):
  `$backendHost`, `$staticRoot`, `$cacheFolder` — since production isn't a docker-compose
  network, the backend (Render) and static assets (SSH host) live at real URLs/paths, not
  container aliases.

## Custom extension code

`proxy/extension/lib/` holds custom PHP classes extending Tent's own `Tent\Middlewares`/
`Tent\Cache` namespaces, wired up via `proxy/extension/loader.php`:

- `CacheControlMiddleware` — sets an explicit `Cache-Control: max-age=<N>` header (used by the
  static-serving prod frontend rule).
- `SetClientIpMiddleware` — overwrites `X-Forwarded-For` with Tent's own view of the client IP,
  so the backend can trust it.
- `TestHeaderMiddleware` — sample middleware demonstrating the extension pattern.
- `DomainHash` — derives a per-domain cache folder name (used internally by Tent's own caching).

This is deliberately a **small, backend-agnostic** set. Don't add classes coupled to
application-specific concepts (e.g. file uploads, per-entity cache cleanup) without a product
decision backing it — see `proxy.md` in `.claude/agents/` for the full rule.

## Coding style

Proxy PHP follows **PSR-12**. The root `phpcs.xml` enforces it for `proxy/extension/lib`,
`proxy/extension/tests`, `proxy/dev_configuration` and `proxy/prod_configuration`. Codacy reads
the same ruleset, and you can check locally with `docker-compose run --rm proxy_lint`.

## Cache bypass (`X-Skip-Cache`)

The backend rule is an **opt-out** cache: Tent shared-caches every 2xx `*.json` response,
keyed by path and query string only (not by HTTP method or caller), unless the response carries
the header named by `'skip_cache_header' => 'X-Skip-Cache'`. The backend decides this per route
through its cache classes (`public`, `user-scoped`, `never`), declared with `@CachePolicy()`;
`user-scoped`, `never`, and any non-GET/HEAD response send `X-Skip-Cache`.

The same rule also carries the freshness and invalidation middlewares:

- `CacheStalenessMiddleware` (`maxAgeSeconds => 10`) serves entries older than 10s while
  refreshing them in the background. The backend's `PUBLIC_MAX_AGE_SECONDS` mirrors this value.
- `CacheCleanupMiddleware` (`clear => ['collection','entity']`) clears the matching collection
  and entity cache entries on any POST/PATCH/PUT/DELETE.

The full strategy — classes, header table, freshness, invalidation, and Navi — lives in
[API Caching](./caching.md). Don't restate it here.

See `.claude/agents/proxy.md` for the full rule-structure reference and local dev commands.
