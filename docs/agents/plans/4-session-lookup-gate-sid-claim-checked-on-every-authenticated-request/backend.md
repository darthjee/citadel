# Backend Plan: Session-lookup gate: sid claim checked on every authenticated request

Main plan: [plan.md](plan.md)

## Overview
Implement the gate specified in
[`docs/agents/specs/user-approval/gate.md`](../../specs/user-approval/gate.md), without the
`user.status = 'approved'` condition (#5). Core defines a `SESSION_LOOKUP` port, the Auth module
implements it with `SessionService#findActiveSessionUser` (one indexed join), `TokenService` signs
`sid`, and `JwtGuard` validates the claims, looks the session up and builds `request.user` from
the DB row.

## Context
- #3 (merged) added `session_uuid` / `started_at` / `revoked_reason` to `auth_refresh_tokens`,
  atomic single-winner rotation (`TokenService#rotateTokens`) and session-wide logout. An active
  session is exactly one non-revoked, unexpired row.
- `JwtGuard` (`backend/src/core/jwt.guard.ts`) is an `APP_GUARD` declared in `AppModule`, which
  imports `AuthModule`; exporting `SESSION_LOOKUP` from `AuthModule` makes it injectable there.
  `core/` must never import `auth/`.
- The auth e2e harness (`auth/tests/support/build-auth-test-app.ts`) uses per-entity in-memory
  repos that cannot run a query-builder join, so the e2e apps override `SESSION_LOOKUP` with an
  in-memory implementation over the repos' live `rows`.
- `core/tests/request-logging.e2e-spec.ts` builds `JwtGuard` in its own `TestAppModule` without
  `AuthModule`; it needs a `SESSION_LOOKUP` stub provider.

## Steps

- [01 — Core: sid claim, SESSION_LOOKUP port and the gate in JwtGuard](backend/01-core-gate.md)
- [02 — Auth: SessionService, module wiring and sid signing](backend/02-auth-session-service.md)
- [03 — Test support and session-gate e2e](backend/03-test-support-and-e2e.md)

## CI Checks
- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Never run `yarn`/`node` on the host; always through `docker-compose`.
- Steps 01 and 02 together break the existing e2e suites until step 03 wires the in-memory
  lookup; run the full suite only after step 03.
- The `security` agent reviews the guard and lookup during implementation (no separate review
  step).
- Out of scope: `user.status = 'approved'` and `admin_denied` (#5); Auth module docs (#7); the
  real MySQL test of `findActiveSessionUser` (#9).
- No reference to local filesystem paths in code or docs; link Kerghan files by their
  `https://github.com/darthjee/kerghan/` URLs.
