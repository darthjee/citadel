# Issue: Session-lookup gate: sid claim checked on every authenticated request

## Description

Part of the user-approval Epic (#1); builds on the refresh-token sessions shipped by #3. Implements
the session-lookup gate specified in
[`docs/agents/specs/user-approval/gate.md`](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/gate.md):
the user's **current DB state** decides every authenticated request. **No status logic yet**: the
`user.status = 'approved'` condition is added by #5.

## Problem

`JwtGuard` (`backend/src/core/jwt.guard.ts`) trusts the JWT claims until the access token expires.
A logged-out session, a user whose sessions were revoked (password reset, replay detection) or a
demoted admin keeps working with a still-valid access token for up to the access-token TTL, and
`AdminGuard` trusts the `isAdmin` claim frozen in the token.

## Expected Behavior

- Every access token carries `sid`, the `session_uuid` of the refresh-token row it was minted with:
  `{ sub, sid, username, isAdmin }`.
- On every non-`@Public()` request, after the signature/expiry check, the guard requires a
  well-formed UUID `sid`, an integer `sub`, and an **active** session (non-revoked, unexpired
  refresh-token row) whose user has `id === sub`.
- `request.user` is built from the **DB row** (fresh `username` / `isAdmin`), so a demoted admin
  gets `403` from `AdminGuard` on the next request.
- Logout, password reset and replay detection take effect on the **next request**.
- Every rejection is the byte-for-byte identical `401 Invalid or expired access token`; a missing
  cookie keeps its `401 Missing access token`; a DB error stays `500`.
- A token without `sid` is simply invalid (no transition path); the frontend's existing
  refresh-and-retry in `ApiClient` mints a `sid`-bearing token transparently.

## Solution

No migration (the `session_uuid` column and index ship with #3). Backend only; no frontend change.

### Core

- `core/access-token-payload.ts`: add `sid: string`.
- New `core/session-lookup.ts`: `SESSION_LOOKUP` injection token, `SessionUser`
  (`{ id, username, isAdmin }`) and `SessionLookup` (`findActiveSessionUser(sid)`). Core never
  imports Auth; Auth provides the implementation.
- `core/jwt.guard.ts`: `canActivate` becomes `async`; inject `SESSION_LOOKUP`. Order: `@Public()`
  skip → missing cookie `401 Missing access token` → signature/expiry against current and previous
  keys → validate claims (`sid` UUID string, `sub` integer) → lookup must return a user with
  `id === sub` → `request.user = { sub, sid, username, isAdmin }` from the row. Every rejection
  from the signature step on throws the same `UnauthorizedException('Invalid or expired access
  token')`; lookup errors propagate. `APP_GUARD` order in `AppModule` is unchanged.

### Auth

- New `auth/session.service.ts`: `SessionService implements SessionLookup` with only
  `findActiveSessionUser`. Citadel has no session list/revoke endpoints, so the Kerghan
  `listActive`, `revoke` and `revokeOthers` methods are **not** ported. One indexed query: `User`
  query builder, `innerJoin(RefreshToken, 'session', 'session.userId = user.id')`,
  `session.sessionUuid = :sid`, `revokedAt IS NULL`, `expiresAt > now`, selecting `id`,
  `username`, `isAdmin`. The join stays inside the Auth module (both `auth_` tables).
- `auth.module.ts`: provide `SessionService` and `{ provide: SESSION_LOOKUP, useExisting:
  SessionService }`; export `SESSION_LOOKUP` (not `SessionService`).
- `token.service.ts`: `issueTokens` signs `sid: sessionUuid` (new or continued session), so login,
  register, refresh and the winning device poll all carry it.

### Test support

- New `auth/tests/support/in-memory-session-lookup.ts` (`InMemorySessionLookup`): the same rules
  over the in-memory repos' live rows (the real join cannot run on them).
- `build-auth-test-app.ts`: `.overrideProvider(SESSION_LOOKUP).useValue(new
  InMemorySessionLookup(userRepo.rows, refreshTokenRepo.rows))`.
- `core/tests/request-logging.e2e-spec.ts`: provide a `SESSION_LOOKUP` stub in its test module
  (it builds `JwtGuard` without `AuthModule`).
- Existing `jwt.guard.spec.ts` / e2e specs that sign tokens by hand gain a `sid` backed by an
  active session.

### Tests

Per [gate.md → Required tests](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/gate.md#required-tests),
excluding the (#5) items:

- `JwtGuard` unit: valid session passes and `request.user` comes from the lookup row (a JWT
  claiming `isAdmin: true` for a non-admin row yields `false`); identical `401` for no `sid`,
  non-UUID `sid`, non-integer `sub`, lookup `null`, `id !== sub` (another user's session), bad
  signature, expired token; lookup throwing propagates; `@Public()` and missing cookie never call
  the lookup; a previous-key token still goes through the lookup.
- `SessionService#findActiveSessionUser` unit (mocked query builder): query shape, user for an
  active session, `null` otherwise.
- `TokenService`: the signed access token carries `sid` equal to the row's `sessionUuid`.
- Session-gate e2e: logout blocks the same access token; two sessions of one user, logging one out
  leaves the other working; after password reset other sessions get `401`; a demoted admin's next
  `@AdminOnly()` call answers `403`; `refresh.json` mints a token whose `sid` equals the session's
  `session_uuid`.

### Out of scope

- `user.status = 'approved'` in the lookup, `admin_denied`: #5.
- Auth module docs (JWT flow, `request.user` source): folded into #7.
- Exercising the real `findActiveSessionUser` join against MySQL: #9 (MySQL-backed integration
  tests).

Kerghan reference: commit [`3f3c691`](https://github.com/darthjee/kerghan/commit/3f3c691) —
[jwt.guard.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/jwt.guard.ts),
[session-lookup.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/session-lookup.ts),
[session.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/session.service.ts),
[in-memory-session-lookup.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/support/in-memory-session-lookup.ts).

### Agents

backend implements; the `security` agent reviews the guard and lookup during implementation
(authentication logic). No separate review step.

## Acceptance criteria

- `JwtGuard` specs: missing / malformed `sid`, revoked session, expired session, `sub` mismatch
  all answer the identical `401`.
- e2e: logout or session revocation blocks the access token on the next request.
- Admin demotion takes effect on the next request.
- `yarn coverage` and `yarn lint` pass (through `docker-compose`).
