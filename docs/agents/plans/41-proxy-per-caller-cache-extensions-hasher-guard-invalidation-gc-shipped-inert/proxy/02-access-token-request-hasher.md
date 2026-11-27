# Per-caller request hasher

Create `Tent\Cache\AccessTokenRequestHasher implements Tent\Cache\RequestHasher` (issue: Expected
Behavior #1, Security #6).

- `hash(RequestInterface $request)`:
  - `AccessTokenCookie::state() === VALID` → `'private_' . hash('sha256', $token . '|' . $request->query())`;
  - otherwise → delegate to Tent's `QueryRequestHasher` (the shared default).

  When the state is `UNUSABLE` the guard has already called `skipCache()`, so the hasher's
  fallback is never used for a cache read or write. The hasher stays a pure key function.
- `static build(array $params)`: option `cookie` (default `access_token`). An empty `cookie` throws
  `InvalidArgumentException`.
- `private_` and `|` are class constants.
- Docblock: the key format, the `ACCESS_TOKEN_COOKIE` coupling, and a note that the raw token never
  appears in a key or filename.

Tests (`tests/cache/AccessTokenRequestHasherTest.php`):

- the same token and query give the same key;
- different tokens give different keys;
- different queries give different keys;
- the delimiter prevents boundary collisions (token `AB` + query `C` vs token `A` + query `BC`
  differ);
- the key matches `^private_[0-9a-f]{64}$`;
- the raw token is not a substring of the key;
- without the cookie, the key equals `(new QueryRequestHasher())->hash($request)`;
- `build()` defaults and the empty-`cookie` failure.

## Files to Change
- `proxy/extension/lib/cache/AccessTokenRequestHasher.php` — new hasher.
- `proxy/extension/tests/cache/AccessTokenRequestHasherTest.php` — new tests.
