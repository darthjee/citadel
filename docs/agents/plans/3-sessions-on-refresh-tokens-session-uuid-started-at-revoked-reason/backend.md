# Backend Plan: Sessions on refresh tokens (session_uuid, started_at, revoked_reason)

Main plan: [plan.md](plan.md)

## Overview

Three migrations, the `RefreshToken` entity changes, the `TokenService` session parameter, the
removal of `Session` / `auth_sessions`, and the `AuthService` changes: refresh check order, atomic
rotation, session-wide logout, and revoke reasons. All of it follows the *Sessions on refresh
tokens*, *Revoked reasons* and *`auth_sessions` dropped* sections of
[model.md](../../specs/user-approval/model.md). No request or response body changes.

## Context

- `TokenService#issueTokens` (`backend/src/auth/token.service.ts`):
  - signs `{ sub, username, isAdmin }`;
  - saves a `RefreshToken` row;
  - calls `#touchSession`, which inserts an `auth_sessions` row that nothing reads.
- `AuthService` (`backend/src/auth/auth.service.ts`):
  - `#findActiveRefreshToken` checks revocation **before** expiry, and replay-revokes the whole
    family on any revoked token.
  - `refresh` revokes with an unconditional `update(id, { revokedAt })`.
  - `logout` revokes by hash only.
  - `#revokeTokenFamily(userId)` is used by `resetPassword` and replay detection.
- Device poll (`AuthorizationRequestService#issueSessionFor`) calls `tokenService.issueTokens(user)`.
  It stays a new session, so no change is needed beyond keeping the call valid.
- The codebase has no transactions yet. Specs use `createInMemoryRepo`
  (`backend/src/auth/tests/support/in-memory-repo.ts`) and Jest `repoMock`s.
- There are no migration specs yet. Follow Kerghan's fake-`QueryRunner` style
  ([example](https://github.com/darthjee/kerghan/blob/main/backend/src/database/tests/auth-add-users-status-migration.spec.ts)).
- Real-MySQL verification is follow-up #9. It is out of scope here.

## Steps

- [01 — Migrations and migration specs](backend/01-migrations.md)
- [02 — RefreshToken entity and RevokedReason](backend/02-entity-and-revoked-reason.md)
- [03 — TokenService sessions and drop the Session entity](backend/03-token-service-and-drop-session.md)
- [04 — Refresh: check order and atomic rotation](backend/04-refresh-rotation.md)
- [05 — Logout ends the session; reasons on bulk revokes](backend/05-logout-and-bulk-revokes.md)

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI job: `backend_checks`)

## Notes

- Never run `yarn`/`node` on the host; always go through docker-compose.
- Rotation order matters. **Insert the replacement first, then revoke conditionally**, inside one
  transaction (the spec explains why). This deliberately differs from Kerghan's non-transactional
  revoke-then-insert.
- Do not touch `docs/agents/modules/auth.md` or `docs/agents/architecture/backend.md`. Their
  `auth_sessions` mentions are folded in #7.
- `ADMIN_DENIED`, the `sid` claim and the gate belong to #5 and #4. Do not add them here.
- Do not add references to local file-system paths. Use GitHub URLs for Kerghan links.
