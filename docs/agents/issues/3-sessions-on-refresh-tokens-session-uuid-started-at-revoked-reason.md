# Issue: Sessions on refresh tokens (session_uuid, started_at, revoked_reason)

## Description

Part of the user-approval Epic (#1). Implements the session groundwork defined in
[model.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/model.md) (sections *Sessions on refresh tokens*, *Revoked reasons* and
*`auth_sessions` dropped*). A **session** is one chain of rotated refresh tokens, identified by a
`session_uuid` shared by every token of the chain. The session-lookup gate (#4) reads it through
the access token's `sid` claim, so this issue must be merged first.

No change to request or response bodies.

## Problem

- `auth_refresh_tokens` has no session identity, so there is nothing for a `sid` claim to point at.
- Revocations only set `revoked_at`. Replay detection therefore fires on **any** revoked token,
  including logged-out ones, and checks revocation before expiry.
- `AuthService#refresh` revokes the presented token with an unconditional update. Two concurrent
  refreshes of the same token both succeed and fork the session into two active rows.
- `logout` revokes only the row that matches the presented hash, so a stale (already rotated)
  token logs nothing out.
- `TokenService#touchSession` inserts an `auth_sessions` row on every issuance and nothing reads
  it: dead data that keeps growing.

## Expected Behavior

- Login, register and a winning device-authorization poll each start a **new** session
  (`randomUUID()`, `started_at = now`). `refresh.json` copies `session_uuid` and `started_at` onto
  the replacement token.
- Rotation is **atomic and single-winner**. In one transaction it inserts the replacement row,
  then revokes the presented row with `UPDATE … WHERE id = ? AND revoked_at IS NULL`. If
  `affected !== 1` it rolls back and answers `401 Invalid or expired refresh token`. Each session
  has at most one active row.
- Every revocation writes a `revoked_reason`:
  - `rotated`
  - `logout` (every active row of the presented token's session, whatever the token's own state)
  - `password_reset` (every active token of the user)
  - `replay_detected` (every active token of the user)
- `refresh.json` check order:
  1. unknown token → `401`;
  2. expired → `401`;
  3. revoked `rotated` → replay detection, then `401`;
  4. revoked for any other reason → plain `401`.
- Bulk revokes only touch active rows, so already-revoked rows keep their reason.
- `auth_sessions` no longer exists and is never written.

## Solution

Backend only (agent: **backend**). Follow [model.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/model.md) exactly.

**Migrations** (after `20260914120010`, in this order):

1. `auth-add-refresh-tokens-session`:
   - add `session_uuid varchar(36)` and `started_at datetime` as nullable;
   - backfill with `UPDATE auth_refresh_tokens SET session_uuid = UUID(), started_at = issued_at`;
   - make both columns `NOT NULL`;
   - add the non-unique index `idx_auth_refresh_tokens_session_uuid`;
   - `down` drops the index and both columns.
2. `auth-add-refresh-tokens-revoked-reason`:
   - add `revoked_reason varchar(32) NULL`;
   - backfill `'rotated'` where `revoked_at IS NOT NULL`;
   - `down` drops the column.
3. `auth-drop-sessions`:
   - drop `auth_sessions`;
   - `down` recreates the **empty** table with its original shape (`id`, `user_id` +
     `idx_auth_sessions_user_id`, `created_at`, `last_seen_at`).

**Code**:

- `RefreshToken` entity:
  - add `sessionUuid` (indexed), `startedAt` and `revokedReason`;
  - export the `RevokedReason` const object/type next to it, with `ROTATED`, `LOGOUT`,
    `PASSWORD_RESET` and `REPLAY_DETECTED`. `ADMIN_DENIED` is added by #5.
- `TokenService#issueTokens(user, session?)`: `session` is an optional `{ sessionUuid, startedAt }`;
  without it, a new session starts.
  - Remove `#touchSession` and the `Repository<Session>` injection.
  - Delete `entities/session.entity.ts` and its `AuthModule` / test-app registrations.
- `AuthService#refresh`:
  - check expiry before revocation;
  - run replay detection only for `rotated` tokens;
  - rotate inside one transaction (`refreshTokenRepository.manager.transaction`), inserting first
    and then revoking conditionally.
- `AuthService#logout`: resolve the presented token's `session_uuid`, then revoke every active
  row of that session with `logout`.
- `#revokeTokenFamily(userId, reason)` takes the reason and only touches rows where
  `revoked_at IS NULL`.

**Tests**:

- Migrations get fake-`QueryRunner` unit specs in a new `backend/src/database/tests/`, as in
  Kerghan.
- Atomic rotation is wrapped in `refreshTokenRepository.manager.transaction`; the in-memory test
  repo gains a pass-through `manager.transaction`.
- "Exactly one winner" and "failed insert rolls back" are service unit tests that simulate
  `affected = 0` and a throwing insert.

Follow-up: #9 adds MySQL-backed integration tests that check these migrations and the real
concurrent rotation against the engine. #3 does not wait on it.

Out of scope:

- the `sid` claim and gate (#4);
- `admin_denied` and user status (#5);
- doc updates for `auth_sessions` in `docs/agents/modules/auth.md` and
  `docs/agents/architecture/backend.md` (folded in #7, per the specs).

Kerghan references (whose rotation is *not* transactional, unlike this spec):

- [token.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/token.service.ts)
- [auth.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/auth.service.ts)
- [20261005120017-auth-add-refresh-tokens-session.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261005120017-auth-add-refresh-tokens-session.ts)
- [20261005120018-auth-add-refresh-tokens-revoked-reason.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261005120018-auth-add-refresh-tokens-revoked-reason.ts)
- [20261009120019-auth-drop-sessions.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261009120019-auth-drop-sessions.ts)
- migration test style: [auth-add-users-status-migration.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/tests/auth-add-users-status-migration.spec.ts)

## Acceptance criteria

All the *Sessions (#3)* items under **Required tests** in [model.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/model.md):

- **Migrations:** `up` and `down` covered for all three.
- **Sessions:** a new session on login, register and poll; two logins give two sessions; refresh
  copies the session.
- **Rotation:** a concurrent refresh gives exactly one winner; a failed insert rolls back.
- **Logout:** a stale-token logout ends only its own session.
- **Reasons:** each revocation site writes its reason; only `rotated` triggers replay detection;
  an expired rotated token gets no replay detection; bulk revokes keep existing reasons.
- **`auth_sessions`:** no write remains.
