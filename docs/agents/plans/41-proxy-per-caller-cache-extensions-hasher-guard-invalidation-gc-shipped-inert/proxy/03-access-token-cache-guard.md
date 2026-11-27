# Cache guard middleware

Create `Tent\Middlewares\AccessTokenCacheGuardMiddleware extends Middleware` (issue: Expected
Behavior #2, Skip mechanism).

- `processRequest(ProcessingRequest $request)`: when `AccessTokenCookie::state() === UNUSABLE`, call
  `$request->skipCache()`. Nothing else:
  - it never adds, removes or rewrites a header;
  - it has no client-sent `X-Skip-Cache` logic (Tent honours that natively);
  - it never logs.
- `processResponse`: pass the response through unchanged.
- `static build(array $attributes)`: option `cookie` (default `access_token`). An empty `cookie`
  throws `InvalidArgumentException`. The clock is constructor-injected only.
- No `method_exists` fallback around `skipCache()` (issue: Backward compatibility #4).

Tests (`tests/middlewares/AccessTokenCacheGuardMiddlewareTest.php`), using a real `ProcessingRequest`:

- `cacheSkipped()` becomes true for each `UNUSABLE` case in step 01. A data provider is fine.
- `cacheSkipped()` stays false:
  - for a valid unexpired single cookie;
  - for no `access_token` cookie;
  - for look-alike names.
- The headers before and after `processRequest` are identical in every case, including an incoming
  `X-Skip-Cache`, which stays in place.
- `build()` defaults and the empty-`cookie` failure.

## Files to Change
- `proxy/extension/lib/middlewares/AccessTokenCacheGuardMiddleware.php` — new middleware.
- `proxy/extension/tests/middlewares/AccessTokenCacheGuardMiddlewareTest.php` — new tests.
