# Shared access-token cookie parser

Create `Tent\Cache\AccessTokenCookie`. It is the single parser used by both the hasher (step 02) and
the guard (step 03), so the two can never disagree (issue: Edge cases #1–#5).

API (suggested; keep it small):

- `__construct(string $cookieName = 'access_token', ?callable $clock = null)`. The clock returns the
  current Unix time and is injectable for tests.
- `state(RequestInterface $request): string` returns one of `ABSENT`, `VALID`, `UNUSABLE`.
- `token(RequestInterface $request): ?string` returns the raw value only when `state` is `VALID`.

Rules:

- Collect `Cookie` header values case-insensitively by header name. **More than one `Cookie`
  header** → `UNUSABLE`.
- Split pairs on `;`, trim whitespace, split each pair on the first `=`. Match the cookie **name
  exactly** (case-sensitive): `my_access_token` and `access_token_v2` never match.
- No matching pair → `ABSENT`.
- More than one matching pair (even with identical values), an empty value, or malformed syntax
  around the match → `UNUSABLE`.
- The value is used **raw**: no URL-decoding, no unquoting.
- JWT checks on the single value. Each of these → `UNUSABLE`:
  - not exactly three `.`-separated segments;
  - a payload segment that is not valid base64url;
  - a payload that is not a JSON object;
  - `exp` missing or not numeric;
  - `exp <= now`.

  No signature check.
- Never log anything.

Tests (`tests/cache/AccessTokenCookieTest.php`):

- ABSENT: no header; other cookies only; the look-alike names above.
- VALID: a single cookie with a future `exp`, surrounded by other cookies, extra whitespace, and
  the raw value preserved (including `%` and `"` characters).
- UNUSABLE, one test per case:
  - duplicate cookie with different values;
  - duplicate cookie with identical values;
  - empty value;
  - two `Cookie` headers;
  - two segments;
  - bad base64url;
  - non-JSON payload;
  - missing `exp`;
  - string `exp`;
  - `exp == now`;
  - `exp < now`.

Use a test helper in `tests/support/` that builds unsigned JWT strings.

## Files to Change
- `proxy/extension/lib/cache/AccessTokenCookie.php` — new parser.
- `proxy/extension/tests/cache/AccessTokenCookieTest.php` — new tests.
- `proxy/extension/tests/support/JwtTestFactory.php` — new helper that builds `header.payload.sig`
  strings with a chosen payload.
