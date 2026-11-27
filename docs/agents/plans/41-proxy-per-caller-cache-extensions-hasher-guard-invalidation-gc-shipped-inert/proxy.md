# Plan: Proxy: per-caller cache extensions (hasher, guard, invalidation, GC), shipped inert

Issue: [41-proxy-per-caller-cache-extensions-hasher-guard-invalidation-gc-shipped-inert.md](../../issues/41-proxy-per-caller-cache-extensions-hasher-guard-invalidation-gc-shipped-inert.md)

## Overview

Implement the citadel-side per-caller cache building blocks as Tent extensions in `proxy/extension/`,
shipped **inert**: they are loaded by `loader.php`, but no rule in `dev_configuration` or
`prod_configuration` references them. Each class has its own PHPUnit test file, run through
docker-compose `proxy_tests` (CI job `proxy_extension_tests`). The issue file is the
specification. Every requirement below refers back to its sections (Skip mechanism, Edge cases,
Backward compatibility, Interaction, Performance & security, Configuration surface, Naming, Tests).

## Context

- **Prerequisite (done manually by the owner before this starts):** darthjee/tent#310 is released in
  Tent 1.3.0, and citadel is bumped to `darthjee/tent:1.3.0` / `darthjee/tent-test:1.3.0`
  (docker-compose and CircleCI). If `ProcessingRequest::skipCache()` is not available in the test
  image, stop and report it as a blocker; do not add a `method_exists` fallback.
- **Reference implementations (read-only):** majora's `proxy/extension/lib/cache/PrivateRequestHasher.php`,
  `lib/middlewares/BearerSkipCacheMiddleware.php`, `lib/middlewares/ResponseCacheClearMiddleware.php`
  and `lib/support/ResponseCacheClearer.php`. These are adapted, not copied verbatim: the cookie
  key instead of a header, `skipCache()` instead of a marker header, and paths with and without an
  extension.
- **Tent cache layout:** `<cache>/<path>/<METHOD>/<hash>.body.dat` + `<hash>.meta.json`. The query
  string is part of the hash, not the folder. `FileCache::exists()` needs both files.
- **Middleware order:** handler built-ins (`RenameHeader`, `SetHeaders`, `FileCacheMiddleware`)
  run first, then the rule's `middlewares`. Only `prependMiddlewares` run before the built-ins.
  The extensions are designed for: guard and invalidation in `prependMiddlewares` (invalidation
  first), the hasher as the handler's `request_hasher`, and GC in `middlewares`.
- **Conventions:**
  - `Tent\` namespaces, PSR-12 (`docker-compose run --rm proxy_lint`), one class per file
    (PSR-1);
  - test doubles in `proxy/extension/tests/support/`;
  - tests build real `ProcessingRequest`s (`new ProcessingRequest(['headers' => ...])`), like
    `SetClientIpMiddlewareTest`;
  - each class exposes `static build(array $attributes)`.
- **Product decision:** `proxy.md` and `.claude/agents/proxy.md` restrict extensions to
  backend-agnostic classes unless a product decision backs them. Epic #33 is that decision.

## Steps

- [01 — Shared access-token cookie parser](proxy/01-access-token-cookie.md)
- [02 — Per-caller request hasher](proxy/02-access-token-request-hasher.md)
- [03 — Cache guard middleware](proxy/03-access-token-cache-guard.md)
- [04 — Tolerant private cache dir remover](proxy/04-private-cache-dir-remover.md)
- [05 — X-Cache-Invalidate middleware](proxy/05-cache-invalidate-header-middleware.md)
- [06 — Probabilistic private-cache GC](proxy/06-private-cache-gc-middleware.md)
- [07 — Loader, interaction tests, doc line and manual verification](proxy/07-loader-interaction-docs.md)

## CI Checks

- `proxy/extension`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `proxy/`: `docker-compose run --rm proxy_lint` (PSR-12, also read by Codacy)

## Notes

- **Logging:** no log line from any class may contain the `Cookie` header, the token, the decoded
  payload, or a `private_*` hash or filename. Every class's tests assert this, by capturing
  Tent's `Logger` output or injecting a logger double.
- **Fixed values:** the `private_` prefix, the `|` delimiter and the GC lock file name are
  class constants, not options.
- **Docs:** listing the new classes in `architecture/proxy.md`'s "Custom extension code" section,
  and every cache-model doc change, are left to the last sub-issue of #33. This issue adds only the
  collision-check line (step 07).
- **Coupling:** GC's `maxAgeSeconds` default (1200) assumes the backend's
  `DEFAULT_ACCESS_TOKEN_TTL_MS` (15 min). Document the coupling with
  `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` in the GC docblock.
- **Review:** dispatch the security agent to review the finished classes before opening the PR.
