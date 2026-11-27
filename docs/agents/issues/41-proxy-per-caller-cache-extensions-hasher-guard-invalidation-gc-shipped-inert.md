# Issue: Proxy: per-caller cache extensions (hasher, guard, invalidation, GC), shipped inert

## Description

Part of epic #33 (per-user cache). Add the citadel proxy extensions that per-caller caching needs, ported and
adapted from majora's proxy (`PrivateRequestHasher`, `BearerSkipCacheMiddleware`,
`ResponseCacheClearMiddleware`), plus a new GC middleware, with PHPUnit tests. They ship
**inert**: no rule uses them yet.

Citadel already runs Tent 1.2.0 (#44), so the earlier Tent upgrade prerequisite is satisfied.

Depends on:
- darthjee/tent#310: the proxy-internal cache-skip flag (`ProcessingRequest::skipCache()`), released
  in Tent 1.3.0;
- citadel bumped to Tent 1.3.0. The project owner does this manually, outside this issue.

Agents involved: proxy, security.

## Problem

Tent (up to 1.2.0) has no per-caller request hasher and does not read `X-Cache-Invalidate`, and it
never prunes cache entries by age. Citadel authenticates with a JWT in the httpOnly `access_token`
cookie (15 min TTL, rotated on refresh), so a per-caller cache must be keyed on that cookie, never
leak between callers, and never serve expired, ambiguous or missing tokens.

## Expected Behavior

All under `proxy/extension/`, loaded by `loader.php`, as was done for `DomainHash`:

1. **Per-caller request hasher**: when the request's `Cookie` header carries exactly one
   `access_token` cookie (exact name, see Edge cases), the key is `private_` + `sha256(<access_token> + '|' + <query>)`. Without the cookie
   it falls back to Tent's default shared query-only key. The raw token never appears in a key or
   filename.
2. **Guard middleware** (request side): calls `$request->skipCache()` (darthjee/tent#310) so the
   request gets no cache read or write when
   - the request carries an `access_token` cookie (exact name) but exactly one well-formed value cannot be
     extracted (duplicates, malformed syntax). It never falls back to the shared key;
   - the JWT payload's `exp` has passed, or the payload cannot be decoded (no signature check
     needed: the exact token string is the key).

   A client-sent `X-Skip-Cache` is not guard logic. Tent already honours it through the rule's
   `skip_cache_header`.
3. **Invalidation middleware** (response side): on a 2xx non-GET/HEAD response, reads
   `X-Cache-Invalidate` (comma-separated absolute paths) and synchronously clears, before the
   response reaches the client:
   - an entry with an extension (`/orgs/1.json`): exactly that path's cache folder;
   - an entry without an extension (`/todo`, `/orgs/1`): the `<path>/` subtree recursively **and**
     the sibling `<path>.json/` folder.
   This clears every caller's entries (`private_*` and shared). The header is always stripped from the
   response, and a client-sent `X-Cache-Invalidate` is dropped from the request. Unsafe or traversal
   paths are rejected. Builds on Tent's `CacheDirCleaner`, like majora's `ResponseCacheClearer`.
4. **Probabilistic GC middleware**: on a configurable fraction of requests (default ~1%), after the
   response is flushed, deletes `private_*` body/meta files older than a configured age (default
   20 min = 15 min access TTL + margin). Each run holds a non-blocking lock and stops after a
   configurable budget (default 5,000 files visited or 200 ms). Shared entries and young files are never touched.

None of the extensions may log the `Cookie` header, the token or its decoded payload.

### Skip mechanism

The guard does not inject a marker header. It uses Tent's proxy-internal per-request flag
(`ProcessingRequest::skipCache()` / `cacheSkipped()`, darthjee/tent#310). The flag is one-way: once
set, no later middleware can re-enable the cache. `FileCacheMiddleware` honours it for both read and
write. As a result:

- the request forwarded to the backend is exactly what the client sent, with no added header;
- the response to the client carries no added header either;
- a client can neither see the guard's decision nor influence it.

| Case | Guard | Cache | Forwarded to backend |
|---|---|---|---|
| Valid, unexpired single `access_token` | none | `private_<sha256(token\|query)>` read/write | as received |
| No `access_token` mentioned | none | shared query-only key | as received |
| Duplicate / malformed / expired / undecodable token | `skipCache()` | no read, no write | as received |
| Client sends `X-Skip-Cache` | none | no read/write (Tent `skip_cache_header`) | as received |
| Backend response carries `X-Skip-Cache` | — | no write (existing) | — |

### Edge cases

Cache layout reminder (Tent 1.2.0): an entry is `<cache>/<request path>/<METHOD>/<hash>.body.dat` +
`<hash>.meta.json` (e.g. `cache/orgs/1.json/GET/private_….body.dat`). The query string is part of
the hash, not the folder, so clearing a path folder covers every method and query variant. `FileCache::exists()`
requires both files. `DomainHash` is not used by any citadel rule, so there are no `domain_*` folders
to handle.

#### Cookie parsing (one parser class shared by the hasher and the guard)

1. **Exact name match.** Only a cookie named exactly `access_token` counts. `my_access_token` and
   `access_token_v2` trigger neither the hasher nor the guard.
2. **One outcome per request.** The hasher and the guard can never disagree:
   - no `access_token` cookie → shared key;
   - exactly one non-empty value → private key;
   - anything else → the guard calls `skipCache()`.
3. **Ambiguous values skip the cache:**
   - an empty value (`access_token=`);
   - more than one `Cookie` header;
   - more than one `access_token` cookie, even with identical values.

   The key uses the raw cookie value as sent, with no URL-decoding or unquoting.
4. **JWT shape.** These skip the cache:
   - a token that does not have three dot-separated segments;
   - a payload that is not valid base64url or JSON;
   - an `exp` that is missing or not numeric;
   - `exp <= now`.
5. **Token expiring mid-request.** A response may be stored under a token that has just expired. This
   is safe: every later request carrying that token is skipped by the guard, and GC removes the entry.
   No clock-skew margin is needed.

#### Invalidation

6. **Path validation.** A path is accepted only when it is absolute and matches
   `^/[A-Za-z0-9._~/-]+$`. These are rejected:
   - `/` (it would wipe the whole cache);
   - `.` or `..` segments;
   - `//`;
   - a trailing `/`;
   - a query string or fragment (not needed, since one folder holds every query variant);
   - percent-encoding.

   A rejected path is logged as a warning with the path only, never a cookie or token.
7. **Header parsing.**
   - Several `X-Cache-Invalidate` lines are merged.
   - Empty entries are ignored.
   - Duplicate or overlapping paths are harmless, because clearing is idempotent.
   - A folder that does not exist is a no-op.
8. **Non-2xx responses and GET/HEAD clear nothing**, but the header is still stripped.
9. **Accepted race.** A GET in flight during a write may re-store the old data after the invalidation
   ran. This is documented and not fixed here:
   - private entries are bounded by token rotation plus GC, at most about 20 minutes;
   - shared entries recover after one stale serve, through `CacheStalenessMiddleware`
     (`maxAgeSeconds` = 10).

#### GC and concurrency

10. **Tolerant deletion.** Invalidation, GC and Tent's own `FileCache::remove()` can delete the same
    files concurrently. Both extensions use a tolerant recursive delete, with their own helper rather
    than relying on `CacheDirCleaner` as-is. darthjee/tent#316 tracks making `CacheDirCleaner` tolerant
    upstream. It is not a dependency here, but once it ships the helper may delegate to it. A file or folder that has already vanished never raises
    a PHP warning and never turns into a 5xx. Deletes stay confined to the cache location.
11. **GC scope.**
    - GC only touches files that match `^private_[0-9a-f]{64}\.(body\.dat|meta\.json)$` and sit
      under the cache location.
    - It never follows symlinks.
    - Age is the file's mtime. A background refresh rewrites the entry, which resets its age.
    - It removes the meta file before the body. An entry with only one file is already a miss.
    - Empty folders are left in place.
12. **Non-FPM SAPIs.** Outside PHP-FPM, "after the response is flushed" degrades to synchronous (the
    same caveat as `CacheStalenessMiddleware`). This is documented, not worked around.

### Backward compatibility

Tent loads `extension/loader.php` automatically on every request (and the `proxy_tests` bootstrap does
too), so the new files are loaded even though no rule uses them.

1. **Existing behaviour unchanged.**
   - `rules/backend.php`, `rules/frontend.php` and the redirect rules are not modified.
   - Caching works exactly as today, including the response-side `X-Skip-Cache`.
   - `X-Cache-Invalidate` keeps reaching the client until the wiring sub-issue of #33 enables the
     invalidation middleware. This is known, accepted behaviour.
2. **Side-effect-free loading.** The new files only declare classes:
   - no global hooks;
   - no shutdown functions at load time (GC registers one only while it runs as a wired middleware);
   - no ini changes.
3. **Existing cache entries are untouched.**
   - The on-disk format does not change and nothing is migrated.
   - Existing shared entries are never touched.
   - GC only deletes `private_*` files, and none exist until the wiring sub-issue ships.
4. **Tent ≥ 1.3.0 is a hard requirement.** The guard calls `ProcessingRequest::skipCache()` directly,
   with no `method_exists` fallback: a silent fallback would mean caching when the guard meant to
   skip. Because nothing is wired, an older Tent still loads the classes. The pinned dependency, plus
   guard tests that exercise the real `ProcessingRequest`, catch a wrong Tent version in CI.
5. **No class-name collisions.**
   - The extensions stay in the project's `Tent\` namespace convention.
   - Their names are chosen to be unlikely to clash with future Tent classes (see Naming).
   - The proxy docs gain a note to re-check for collisions on every Tent bump, because a clash would
     be a fatal "cannot declare class" on every request.
6. **Mixed-version rollout is safe.**
   - Nothing reads the new headers until the wiring sub-issue, so the old/new proxy can run with the
     old/new backend in any deploy order.
   - The epic's hard ordering constraint (per-caller key live before any `user-scoped` response
     carries `X-Cache-Allow`) is met by this issue landing first.
7. **Existing PHPUnit suite.**
   - The existing tests (`DomainHash`, `CacheControl`, `SetClientIp`, `TestHeader`) keep passing on
     Tent 1.3.0.
   - New shared test doubles go in `tests/support/`, one class per file (PSR-1).

### Interaction with existing middlewares

Tent order: `default_proxy` installs `RenameHeader(Host)`, `SetHeaders(Host)` and
`FileCacheMiddleware` first. A rule's `middlewares` run **after** them, and only `prependMiddlewares`
run **before**. Request and response sides both run in list order. The extensions are designed for
this placement; the wiring itself belongs to a later sub-issue of #33.

1. **Guard → `prependMiddlewares`**, so it runs before `FileCacheMiddleware` reads the cache.
2. **Hasher → the handler's `request_hasher`.** `CacheStalenessMiddleware` and
   `BackgroundRefresher` build `FileCache` without a hasher. They reuse the hash `FileCacheMiddleware`
   stored on the request (`ProcessingRequest::cacheHash()`), so a stale hit refreshes into the same
   `private_*` entry. A test proves the refreshed entry lands under the private key, not the shared
   one.
3. **Invalidation → `prependMiddlewares`, before the guard** (majora's order).
   - On the request side it drops a client-sent `X-Cache-Invalidate` before anything else sees it.
   - On the response side it strips the header before `FileCacheMiddleware` stores response headers,
     so the header can never be cached.
4. **`CacheCleanupMiddleware` stays as it is** (`clear: [collection, entity]`) during the rollout, as
   a safety net.
   - It clears on the request side, before the backend writes.
   - For `.json` APIs its `collection` target misses the list folder: `PATCH /orgs/1.json` clears
     `orgs/GET`, while the list lives in `orgs.json/GET`.
   - `X-Cache-Invalidate` (after the write, exact paths) becomes the authoritative mechanism.
   - Whether to remove `CacheCleanupMiddleware` is decided in the last sub-issue of #33.
5. **`CacheStalenessMiddleware` with private entries.**
   - Expired tokens are skipped by the guard, so they never get a hit and never trigger a refresh.
   - The refresh replays the caller's `Cookie`, so it re-authenticates as the same caller.
   - A logged-out or revoked token that has not yet expired keeps getting its own cached data until
     `exp` (at most 15 min, and only for whoever holds that exact token string). This is an accepted
     risk (see Performance & security).
6. **GC and the background refresh share PHP's shutdown phase.** GC registers a shutdown function
   that calls `fastcgi_finish_request()` when available. That call is safe to repeat, so GC coexists
   with the staleness refresh whatever their order. This is covered by a test.
7. `SetClientIpMiddleware` and `CacheControlMiddleware` do not interact with the extensions.

### Performance & security

#### Performance

1. **Hit rate.** Token rotation (15 min) costs each caller at most one miss per route and query per
   rotation. The epic already accepts this.
2. **Disk growth.**
   - A caller has at most about two generations of entries on disk (current token, plus the previous
     one until GC removes it at 20 min).
   - Disk use therefore grows with active callers × routes × query variants.
   - No size cap in this issue. Disk usage should be watched once the wiring sub-issue ships.
3. **GC cost.** GC runs after the response is flushed, but it still occupies a PHP-FPM worker, so
   each run is bounded:
   - **Single runner:** a non-blocking `flock` on a lock file in the cache location. If another GC
     holds it, this run skips.
   - **Budget:** each run stops after a configurable number of files visited (default 5,000) or a
     time budget (default 200 ms), whichever comes first.
   - **No saved progress between runs:** each run starts from a random top-level folder, so the tree
     is covered over successive runs.
4. **Invalidation cost.** Clearing is synchronous, before the response, and proportional to the
   entries under the listed paths (e.g. `/orgs` covers every caller's org sub-resources).
   - It must stay synchronous so a caller always sees their own write. It has no budget; this is
     documented.
   - The duration is logged at debug level.
5. **Guard and hasher.** Cookie parsing, base64url and JSON decoding of the payload, and one SHA-256
   per request cost almost nothing.

#### Security

6. **No leaks between callers.**
   - The key is `sha256(token|query)`, with the `|` delimiter preventing boundary collisions.
   - The token comes only from the `access_token` cookie.
   - A present but unusable cookie never falls back to the shared key.
   - The hasher and the guard share one parser.
7. **Response headers in cached entries.** Tent's default exclusion of `Set-Cookie`, `Set-Cookie2`,
   `WWW-Authenticate` and `Proxy-Authenticate` from cached headers must be kept. Constraint for the
   wiring sub-issue: never narrow `excluded_headers` on the backend rule.
8. **Logging.**
   - Never logged: the `Cookie` header, the token, the decoded payload, or `private_*` hashes and
     filenames (stable per-session identifiers).
   - Allowed: GC counts (files visited and deleted) and duration; invalidation duration; rejected
     invalidation paths, passed through `json_encode` to prevent log injection.
9. **Invalidation trust.**
   - Only backend responses can trigger it; a client-sent `X-Cache-Invalidate` is dropped on the
     request side.
   - Path validation rejects `/` and traversal.
   - The backend is trusted to invalidate across callers.
10. **No JWT signature check.** The exact token string is the key, so a forged token with a future
    `exp` only gets its own key. The backend answers it with a 401, which is not stored. So forged
    tokens produce misses, not stored entries.
11. **Accepted, documented risks.**
    - A logged-out or revoked but unexpired token keeps getting its own cached data until `exp`
      (at most 15 min, only for whoever holds that exact token string).
    - Disk-filling by varying query strings already exists with shared keys. Per-caller keys add
      only one set of entries per valid session.
12. **Personal data at rest.**
    - Private entries are stored unencrypted in the `proxy_cache` volume, mounted at
      `/var/www/html/cache/`, inside the web root.
    - This issue verifies manually (see Verification) that nothing under `/cache/` can be fetched over HTTP: every request goes
      through Tent's front controller, and no static handler maps that folder.
    - If the check fails, moving the cache out of the web root becomes an infra follow-up issue.
13. **Filesystem safety.** GC and invalidation never follow symlinks, and every delete stays inside
    the cache location (see Edge cases).

### Configuration surface

Every extension is built through Tent's `build(array $attributes)` convention. Class names: see Naming.

| Extension | Option | Default | Notes |
|---|---|---|---|
| Hasher (handler `request_hasher`) | `cookie` | `access_token` | must match the backend's `ACCESS_TOKEN_COOKIE` |
| Guard (`prependMiddlewares`) | `cookie` | `access_token` | must match the hasher's `cookie` |
| Invalidation (`prependMiddlewares`) | `location` | — (required) | must match the handler's cache folder (`$cacheFolder`) |
| | `header` | `X-Cache-Invalidate` | |
| GC (`middlewares`) | `location` | — (required) | must match `$cacheFolder` |
| | `probability` | `0.01` | 0–1; `0` disables GC |
| | `maxAgeSeconds` | `1200` | keep ≥ the backend access-token TTL |
| | `maxFiles` | `5000` | positive integer |
| | `maxMilliseconds` | `200` | positive integer |

Deliberately **not** configurable:

- the `private_` prefix and the `|` delimiter (GC's file pattern and the key's safety depend on them);
- which responses trigger invalidation (2xx, methods other than GET/HEAD) and the rejected path
  forms;
- the guard's skip mechanism (always `skipCache()`, so there is no header option);
- the GC lock file name (a constant such as `.private_cache_gc.lock`, never matched by GC's own
  pattern);
- the clock and randomness, which are constructor-injected for tests only.

Cross-value consistency:

1. **`maxAgeSeconds` and the token TTL.** An entry is dead once its token's `exp` has passed, which
   is at most one TTL after the token was issued. So `maxAgeSeconds` ≥ TTL is the efficient setting;
   a smaller value is safe but causes extra misses.
   - The default (1200 s) assumes `DEFAULT_ACCESS_TOKEN_TTL_MS` (15 min).
   - The coupling with `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` is documented in the docblock and in
     the rule comment, like the existing `maxAgeSeconds` ↔ `PUBLIC_MAX_AGE_SECONDS` note.
   - There is no runtime check, because the proxy cannot read the backend's environment variables.
2. **`cookie`.** The defaults match the backend's `ACCESS_TOKEN_COOKIE`, so rules do not pass `cookie`
   and no new `locals.php` variable is added. The docblocks note the coupling.
3. **`location`** receives `$cacheFolder`, as `CacheCleanupMiddleware` and `CacheStalenessMiddleware`
   already do.

Invalid configuration fails loudly: `build()` throws `InvalidArgumentException` for any of these, with
no silent fallback to the defaults:

- a missing or empty `location`;
- `probability` outside 0–1;
- an age, file limit or time limit that is not positive;
- an empty `cookie` or `header`.

## Solution

Port majora's classes and their tests, then adapt them to the cookie-based key and to citadel's header names.
Make the randomness and the clock injectable so the GC middleware is testable.

### Tests (PHPUnit, through docker-compose `proxy_tests`)

- **Hasher**: the same token and query give the same key; different tokens give different keys; the `|`
  delimiter prevents boundary collisions (`"AB"+"C"` vs `"A"+"BC"`); the raw token is never in the key;
  without the cookie the key equals Tent's default.
- **Guard**: `cacheSkipped()` becomes true when the request mentions `access_token` but has no
  usable token, for duplicated or malformed cookies, an expired `exp` and an undecodable payload.
  It stays false for a valid, unexpired single cookie and for a request without `access_token`.
  The guard never adds, removes or rewrites any header.
- **Parser**:
  - exact-name matching (`my_access_token` and `access_token_v2` are ignored);
  - an empty value, multiple `Cookie` headers and duplicate identical values all count as ambiguous;
  - the raw value is used as-is;
  - each JWT-shape failure in Edge cases #4 is covered.
- **Invalidation**: clears listed subtrees across all callers; `/todo` also clears `todo.json/`,
  `.json` entries clear only their own folder; non-2xx and GET/HEAD clear nothing; the header is
  always stripped; traversal paths are rejected; a client-sent header is dropped. Also covered:
  - `/`, `//`, a trailing `/`, a query string and percent-encoding are rejected;
  - multiple header lines are merged;
  - a missing folder is a no-op;
  - a folder deleted mid-walk raises no warning.
- **Interaction**: a stale hit on a `private_*` entry refreshes into the same private key; GC
  and a staleness refresh in the same request both complete.
- **Configuration**: defaults apply when options are omitted; each invalid value listed under
  Configuration surface throws `InvalidArgumentException`; `probability: 0` never runs GC.
- **GC limits**: a run skips while another holds the lock; a run stops at the file and time
  budgets; the clock and randomness are injected.
- **Logging**: no log line from any extension contains the cookie, token, payload or a `private_*`
  hash.
- **GC**: deletes only old `private_*` files, leaves shared entries and young files alone, and does
  nothing when the random draw misses; never follows symlinks; tolerates files vanishing
  mid-walk.

### Naming

Every name has an `AccessToken`/`PrivateCache` prefix, to avoid colliding with future Tent classes.
All classes use the project's `Tent\` namespace convention.

| Role | Class | File |
|---|---|---|
| Shared cookie and JWT parser | `Tent\Cache\AccessTokenCookie` | `proxy/extension/lib/cache/AccessTokenCookie.php` |
| Per-caller hasher | `Tent\Cache\AccessTokenRequestHasher` | `proxy/extension/lib/cache/AccessTokenRequestHasher.php` |
| Guard | `Tent\Middlewares\AccessTokenCacheGuardMiddleware` | `proxy/extension/lib/middlewares/AccessTokenCacheGuardMiddleware.php` |
| Invalidation | `Tent\Middlewares\CacheInvalidateHeaderMiddleware` | `proxy/extension/lib/middlewares/CacheInvalidateHeaderMiddleware.php` |
| GC | `Tent\Middlewares\PrivateCacheGcMiddleware` | `proxy/extension/lib/middlewares/PrivateCacheGcMiddleware.php` |
| Tolerant delete helper | `Tent\Content\PrivateCacheDirRemover` | `proxy/extension/lib/content/PrivateCacheDirRemover.php` |

All six are `require_once`d from `proxy/extension/loader.php`. Tests mirror the layout under
`proxy/extension/tests/`.

### Docs

`docs/agents/architecture/proxy.md` gains one line saying that extension class names must be
re-checked for collisions with Tent's own classes on every Tent bump. This is the only doc change in
this issue; the cache-model docs stay in the last sub-issue of #33.

### Verification (manual)

Check against the dev proxy that a request for a path under `/cache/` (e.g. a known
`cache/<path>/GET/<hash>.body.dat`) never returns a cache file's contents. Record the result in the
PR. If it fails, open an infra follow-up to move the cache out of the web root.

### Scope

In scope:

- the four extensions (hasher, guard, invalidation, GC) under `proxy/extension/lib/`, loaded by
  `loader.php`;
- their PHPUnit tests, run through the docker-compose `proxy_tests` service.

Exception to epic #33's "no Tent upstream change" rule: the guard relies on the cache-skip flag from
darthjee/tent#310. That flag is implemented and released in Tent outside this issue.

### Out of scope

- Wiring the extensions into `rules/backend.php` and any backend change (sub-issue 3 of #33).
- Implementing darthjee/tent#310 and bumping citadel to Tent 1.3.0. Both are done manually before
  this issue starts.
- Docs for the new cache model, other than the single proxy.md line above (`architecture/caching.md`, `architecture/proxy.md`, `flow.md`,
  `cache-warmer.md`), which belong to the last sub-issue of #33.
- Correcting `architecture/caching.md`'s claim that Tent's cache key "ignores the HTTP method"
  (Tent 1.2.0 stores each method in its own folder). This belongs to the docs sub-issue of #33.
- Evicting stale entries on a failed refresh (a Tent-level change, darthjee/tent#306).
