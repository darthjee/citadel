# Loader, interaction tests, doc line and manual verification

Wire the classes into loading (not into any rule), add the cross-middleware tests, the single doc
line and the manual check (issue: Backward compatibility, Interaction, Docs, Verification).

1. **`proxy/extension/loader.php`:** `require_once` the six new files in dependency order:
   `AccessTokenCookie`, `AccessTokenRequestHasher`, `PrivateCacheDirRemover`, then the three
   middlewares. Loading has no side effects, so do not touch `rules/*.php` in either configuration
   folder.
2. **Interaction tests** (`tests/integration/PrivateCacheInteractionTest.php`), built with Tent's
   `DefaultProxyRequestHandler` / `FileCacheMiddleware` and a fake HTTP client where available:
   - With the guard in `prependMiddlewares` and an unusable token, the handler's
     `FileCacheMiddleware` neither reads nor writes. No header is added to the upstream request or
     the response.
   - With `AccessTokenRequestHasher` as `request_hasher`, a stale hit served through
     `CacheStalenessMiddleware` refreshes into the same `private_*` entry, not the shared key.
   - GC and a staleness refresh scheduled in the same request both complete.
   - With the invalidation middleware prepended, a GET response that wrongly carries
     `X-Cache-Invalidate` is stored without that header.

   If Tent's test image does not allow a fake HTTP client for `BackgroundRefresher`, cover the
   refresh case by asserting that `ProcessingRequest::cacheHash()` memoises the private key that
   `FileCache` reuses. Record the limitation in the PR.
3. **Existing suite:** `DomainHash`, `CacheControl`, `SetClientIp` and `TestHeader` tests pass
   unchanged on Tent 1.3.0. Run `proxy_lint`.
4. **Doc line in `docs/agents/architecture/proxy.md`** ("Custom extension code"): add one sentence
   saying that extension classes live in Tent's namespaces, so their names must be re-checked for
   collisions with Tent's own classes on every Tent bump.
5. **Manual verification** (record in the PR):
   1. Run `docker-compose up citadel_placeholder_proxy`.
   2. Place a dummy `docker_volumes/proxy_cache/x/GET/test.body.dat`.
   3. Confirm `curl -i http://localhost:3000/cache/x/GET/test.body.dat` does not return its
      contents.

   If it does, stop and report it: an infra follow-up issue must move the cache out of the web
   root.

## Files to Change
- `proxy/extension/loader.php` — require the six new classes.
- `proxy/extension/tests/integration/PrivateCacheInteractionTest.php` — new cross-middleware tests.
- `docs/agents/architecture/proxy.md` — one-line collision-check note.
