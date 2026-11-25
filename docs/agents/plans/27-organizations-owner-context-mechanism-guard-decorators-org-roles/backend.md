# Backend Plan: Organizations: owner-context mechanism (guard, decorators, org roles)

Main plan: [plan.md](plan.md)

## Overview

Bring the owner-context mechanism into `backend/src/core/`, staying close to the original (ward) so fixes can
flow between citadel and its derived projects. Then wire it globally without changing any existing route, add
the coverage specs that keep future owner-scoped controllers honest, remove the ported `code_sample/` files, and
fold the mechanism into the permanent docs.

## Context

- #26 is merged: `backend/src/core/parse-id.ts` (`parseId`, `MAX_ID`, `ownerNotFound`) and
  `backend/src/core/strict-validation.pipe.ts` (`@StrictBody()`) exist, and the no-port core samples are gone.
- Remaining samples under `docs/agents/specs/orgs/code_sample/backend/src/core/`. Everything is ported here
  **except** `cache-class.ts` and `cache-policy.interceptor.ts`, which belong to #33 (`X-Cache-Allow` model).
- `core/` never imports `auth/`. Ports follow the existing `SESSION_LOOKUP` pattern: a `Symbol` token in
  `core/`, implemented in `auth/` and bound with `useExisting` in `AuthModule`, which exports the token.
- `AccessTokenPayload` is `{ sub, sid, username, isAdmin }` (identical to the sample), so the guard's
  `user.sub` works unchanged.
- Current global chain in `backend/src/app.module.ts`: `OriginGuard`, `JwtGuard`, `AdminGuard` (`APP_GUARD`),
  `CachePolicyInterceptor` (`APP_INTERCEPTOR`), `HttpExceptionFilter` (`APP_FILTER`).
- Decisions from the issue: register globally in this issue with a fail-closed default lookup; drop the
  "> 0 owner-scoped routes" assertions (restored by #31, comment already posted there); write the plain-`@Body()`
  and invalidation coverage specs; share route discovery with `cache-policy.coverage.spec.ts`; the e2e expects
  `X-Skip-Cache`, not `X-Cache-Allow`; no error-code changes.

## Steps

- [01 — Port roles, owner context, parseOrgId and the membership port](backend/01-port-roles-owner-context-port.md)
- [02 — Port the decorators and cache invalidation](backend/02-port-decorators-cache-invalidation.md)
- [03 — Port the guard and wire it globally](backend/03-port-guard-global-wiring.md)
- [04 — Coverage specs and shared route discovery](backend/04-coverage-specs-route-discovery.md)
- [05 — Delete the ported samples and update the sample indexes](backend/05-delete-ported-samples.md)
- [06 — Document the owner-context mechanism](backend/06-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn build` (type check of the ported files and
  the `express.d.ts` augmentation)

Never run `yarn`/`node` on the host.

## Notes

- **Stay close to the original.** Port files as-is; only change what citadel needs. Make ward-specific
  comments generic ("Ward's global admin" -> "the global admin"; `bank` examples may stay as illustrations
  or become a generic `<module>`). Do not add behaviour.
- **No existing route changes.** No current controller uses `@OwnerScoped()` or an invalidation decorator, so the
  guard returns `true` immediately and the interceptor passes through. The whole existing suite must pass
  unchanged.
- **#28 handover.** #28 removes the `AppModule` binding of `ORGANIZATION_MEMBERSHIP_LOOKUP` to the default and
  binds `OrganizationService` (`useExisting`) in `AuthModule`, exporting the token. The default class may then be
  deleted or kept for tests; that is #28's call. Mention this in the default's doc comment.
- **ESLint `max-lines` is 300.** Split a spec (e.g. the guard spec or the e2e spec) if a port or adaptation
  pushes it over.
- **Reviews.** The cache review is covered by keeping `@CachePolicy(CacheClass.UserScoped)` on
  `@OwnerScopedController()`; `cache-policy.coverage.spec.ts` still enforces a declared class everywhere.
  Security: the 404-before-403 order, the uniform 404 for non-members, global admins included, and the
  no-caching rule are all asserted by the ported guard spec. Keep those cases intact when adapting.
- `X-Cache-Invalidate` is emitted but not yet consumed by the proxy (#33). It is harmless because no
  route declares an invalidation yet, and the proxy forwards it untouched.
