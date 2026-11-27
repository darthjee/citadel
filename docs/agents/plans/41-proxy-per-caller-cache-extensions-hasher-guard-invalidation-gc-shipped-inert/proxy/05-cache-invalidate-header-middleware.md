# X-Cache-Invalidate middleware

Create `Tent\Middlewares\CacheInvalidateHeaderMiddleware extends Middleware` (issue: Expected
Behavior #3, Edge cases #6–#9, Interaction #3, Security #8–#9). It is adapted from majora's
`ResponseCacheClearMiddleware` / `ResponseCacheClearer`.

- `processRequest`: remove every client-sent copy of the configured header (case-insensitive) with
  `$request->removeHeader()`.
- `processResponse`:
  1. Collect the header's values from every response header line (case-insensitive name), split on
     `,`, trim, and drop empty entries.
  2. Clear only when the status is 2xx **and** the request method is not GET/HEAD. For each
     **valid** path:
     - with an extension in the last segment (`/orgs/1.json`): remove `<location>/<path>/`;
     - without one (`/todo`, `/orgs/1`): remove `<location>/<path>/` **and** `<location>/<path>.json/`.

     All removal goes through `PrivateCacheDirRemover`. It clears every caller's entries (private
     and shared), for every method and query.
  3. **Always** return the response with every line of the header stripped, including on non-2xx
     and GET/HEAD responses.
- **Validation:** accept only `^/[A-Za-z0-9._~/-]+$`. Reject:
  - `/`;
  - any `.` or `..` segment;
  - `//`;
  - a trailing `/`;
  - `?` or `#`;
  - `%`.

  Each rejection logs a warning `json_encode`d with the path only.
- Log the clearing duration at debug level, with no paths beyond the validated ones.
- `static build(array $attributes)`:
  - `location` is required; empty or missing throws `InvalidArgumentException`;
  - `header` defaults to `X-Cache-Invalidate`; an empty `header` throws.

Tests (`tests/middlewares/CacheInvalidateHeaderMiddlewareTest.php`), using temp cache fixtures with
`private_*` and shared entries under `GET/` folders:

- clears listed subtrees for all callers;
- `/todo` also clears `todo.json/`;
- `/orgs/1.json` clears only its own folder, leaving `orgs.json/` and `orgs/2.json/` alone;
- non-2xx clears nothing;
- GET and HEAD clear nothing;
- the header is stripped in every case;
- several header lines are merged;
- empty entries are ignored;
- a missing folder is a no-op;
- each rejected path form is refused and logged without any cookie or token;
- a client-sent header is removed from the request;
- `build()` failures.

## Files to Change
- `proxy/extension/lib/middlewares/CacheInvalidateHeaderMiddleware.php` — new middleware.
- `proxy/extension/tests/middlewares/CacheInvalidateHeaderMiddlewareTest.php` — new tests.
- `proxy/extension/tests/support/CacheFixtureBuilder.php` — new helper that writes body/meta
  fixtures (shared with step 06).
