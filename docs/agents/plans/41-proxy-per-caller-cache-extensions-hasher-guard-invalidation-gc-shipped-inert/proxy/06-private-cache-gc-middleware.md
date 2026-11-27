# Probabilistic private-cache GC

Create `Tent\Middlewares\PrivateCacheGcMiddleware extends Middleware` (issue: Expected Behavior #4,
Edge cases #11–#12, Interaction #6, Performance #3, Configuration surface).

- `processResponse`: draw from the injected random source. When `draw < probability`, register a
  shutdown function that does the following:
  1. Call `fastcgi_finish_request()` when it exists. It is safe if the staleness refresher already
     called it.
  2. Take a non-blocking `flock` on `<location>/.private_cache_gc.lock`, which is a class constant.
     If the lock is not acquired, skip this run.
  3. Starting from a random top-level folder of `<location>` (wrapping around), walk files without
     following symlinks. Stop at `maxFiles` visited or `maxMilliseconds` elapsed, both measured with
     the injected clock.
  4. Only files matching `^private_[0-9a-f]{64}\.(body\.dat|meta\.json)$` whose mtime is older than
     `maxAgeSeconds` are candidates. Delete the meta file before the body, through
     `PrivateCacheDirRemover::removeFile()`.
  5. Leave empty folders. Never touch shared entries, young files or the lock file.
  6. Log counts (visited and deleted) and the duration only, never filenames.

  Return the response unchanged.
- `probability: 0` never registers anything.
- Constructor-injected: the random source, the clock, and a "scheduler" (defaulting to
  `register_shutdown_function`), so tests can run the job synchronously.
- `static build(array $attributes)`. Each invalid value throws `InvalidArgumentException`.

  | Option | Default | Valid values |
  |---|---|---|
  | `location` | — (required) | non-empty |
  | `probability` | `0.01` | 0–1 |
  | `maxAgeSeconds` | `1200` | > 0 |
  | `maxFiles` | `5000` | > 0 |
  | `maxMilliseconds` | `200` | > 0 |

- The docblock notes:
  - keep `maxAgeSeconds` ≥ `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS`;
  - the non-FPM SAPI caveat (the run is synchronous there).

Tests (`tests/middlewares/PrivateCacheGcMiddlewareTest.php`):

- deletes only old `private_*` body and meta files;
- leaves shared entries, young private files and the lock file alone;
- does nothing when the draw misses;
- `probability: 0` never schedules;
- a run skips while the lock is held by another handle;
- stops at the `maxFiles` and `maxMilliseconds` budgets (fake clock);
- never follows symlinks;
- tolerates files vanishing mid-walk;
- emits no log line containing `private_` or a token;
- `build()` defaults and each invalid value.

## Files to Change
- `proxy/extension/lib/middlewares/PrivateCacheGcMiddleware.php` — new middleware.
- `proxy/extension/tests/middlewares/PrivateCacheGcMiddlewareTest.php` — new tests.
