# Architecture

## Overview

Citadel Placeholder is structured as two independent applications — a NestJS backend and a React/Vite
frontend — served together through the Tent proxy. This repository
documents the architecture split by concern to keep agent contexts small.

This page is the hub. See the area pages for details:

- [Proxy](./architecture/proxy.md)
- [Frontend](./architecture/frontend.md)
- [Backend](./architecture/backend.md) — NestJS + TypeORM + MySQL stack, layout, build, and
  testing conventions. The domain data model (see `docs/agents/product.md`) is left to each
  project built from this template — only the Auth and Mail modules exist so far.
- [Modular Pattern](./architecture/modular-pattern.md) — the cross-cutting rules (module
  classification, lazy loading, inter-module communication, database strategy) every backend
  module, present or future, must follow.
- [API Caching](./architecture/caching.md) — the opt-out Tent cache for `*.json`, the
  `public`/`user-scoped`/`never` cache classes declared with `@CachePolicy()`, the
  `Cache-Control` policy, freshness/invalidation semantics, and what Navi may warm.
- [Security](./architecture/security.md) — cross-cutting security posture, starting with CSRF
  (the `SameSite=Strict` cookie, the CORS allowlist and the global `OriginGuard`).
- [Infra](./architecture/infra.md) — the CircleCI release pipeline's job graph (test/lint jobs,
  the semver-tag-gated release chain, and the base-image publish jobs feeding it).
