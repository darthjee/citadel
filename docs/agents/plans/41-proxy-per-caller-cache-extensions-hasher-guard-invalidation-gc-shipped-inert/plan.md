# Plan: Proxy: per-caller cache extensions (hasher, guard, invalidation, GC), shipped inert

Issue: [41-proxy-per-caller-cache-extensions-hasher-guard-invalidation-gc-shipped-inert.md](../../issues/41-proxy-per-caller-cache-extensions-hasher-guard-invalidation-gc-shipped-inert.md)

## Overview

Add six PHP classes under `proxy/extension/lib/`, each with PHPUnit tests:

- a shared `access_token` cookie/JWT parser;
- a per-caller request hasher;
- a cache guard that calls Tent 1.3.0's `ProcessingRequest::skipCache()`;
- an `X-Cache-Invalidate` response middleware;
- a bounded probabilistic GC for `private_*` entries;
- a tolerant directory remover.

All are loaded by `loader.php`, and no rule uses them yet. The proxy agent owns all the work. The
security agent reviews the result (read-only).

See [proxy.md](proxy.md) for the full plan.
