# Data model

Back to the [feature README](README.md).

Three groups of changes, shipped by two sub-issues:

| Section | Implemented by |
|---|---|
| [Sessions on refresh tokens](#sessions-on-refresh-tokens), [Revoked reasons](#revoked-reasons), [`auth_sessions` dropped](#auth_sessions-dropped) | #3 |
| [User status](#user-status) | #5 |

All tables belong to the Auth module (`auth_` prefix); migrations follow the
`backend/src/database/migrations/<timestamp>-auth-<action>.ts` convention.

## Sessions on refresh tokens

A **session** is one chain of rotated refresh tokens, identified by a `session_uuid` that every
token of the chain shares. It replaces the never-read `auth_sessions` rows as Citadel's notion of
a session, and is what the access token's `sid` claim points at ([gate.md](gate.md)).

`auth_refresh_tokens` gains:

| Column | Type | Notes |
|---|---|---|
| `session_uuid` | `varchar(36) NOT NULL` | Non-unique index (`idx_auth_refresh_tokens_session_uuid`): a rotated chain leaves several rows per session |
| `started_at` | `datetime NOT NULL` | When the chain's login happened |

Entity (`backend/src/auth/entities/refresh-token.entity.ts`):

```ts
@Index()
@Column({ name: 'session_uuid', length: 36 })
  sessionUuid!: string;

@Column({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;
```

Migration: add both columns nullable → `UPDATE auth_refresh_tokens SET session_uuid = UUID(),
started_at = issued_at` (each existing row becomes its own session) → make both `NOT NULL` →
create the index. `down` drops the index and both columns.

Rules:

- Every **login**, **register** and **winning device-authorization poll** mints a **fresh**
  `session_uuid` (`randomUUID()`) with `started_at = now`.
- `refresh.json` **copies** `session_uuid` and `started_at` onto the replacement token, so a
  session survives rotation. `TokenService#issueTokens` therefore takes an optional existing
  session (`{ sessionUuid, startedAt }`); without one it starts a new session.
- Since rotation revokes the presented token, at most one row per session is unrevoked at a time.
  An **active session** is exactly one non-revoked, unexpired `auth_refresh_tokens` row.
- No behaviour change for clients: request and response bodies are unchanged.

## Revoked reasons

`auth_refresh_tokens` gains `revoked_reason varchar(32) NULL`, set together with `revoked_at` on
every revocation. `RevokedReason` is a const object exported next to the entity:

```ts
export const RevokedReason = {
  ROTATED: 'rotated',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',
  REPLAY_DETECTED: 'replay_detected',
  ADMIN_DENIED: 'admin_denied', // added by #5
} as const;
export type RevokedReason = typeof RevokedReason[keyof typeof RevokedReason];
```

These are the revocation sites Citadel has today, plus deny:

| Reason | Written by |
|---|---|
| `rotated` | `AuthService#refresh` (`refresh.json`), on the presented token |
| `logout` | `AuthService#logout` (`DELETE /auth/logoff.json`) |
| `password_reset` | `AuthService#resetPassword` (`reset-password.json`), on every active token of the user |
| `replay_detected` | Replay detection in `refresh.json`, on every active token of the user |
| `admin_denied` | `deny.json`, and the `refresh.json` / `status.json` re-checks of a denied user ([api/auth.md](api/auth.md), [api/admin.md](api/admin.md)) |

Kerghan's `user_revoked`, `password_change` and `admin_password_change` are **not** added: Citadel
has no session list, and neither My Account nor the admin edit revokes sessions today. A future
change that adds such a revocation adds its reason then.

- **Only `rotated` triggers replay detection.** A re-presented token revoked for any other reason
  gets a plain `401`. In particular, a token revoked with `admin_denied` never revokes the user's
  other tokens when replayed.
- `refresh.json` check order: unknown token → `401`; **expired** → `401`; revoked `rotated` →
  replay detection (revoke every active token with `replay_detected`) then `401`; revoked for any
  other reason → `401`. Expiry is checked before replay detection, so a long-expired rotated token
  no longer triggers it.
- A bulk revoke (`password_reset`, `replay_detected`, `admin_denied`) only touches **active**
  rows (`revoked_at IS NULL`); already-revoked rows keep their original reason, preserving replay
  evidence.
- Migration: add the column nullable; backfill `revoked_reason = 'rotated'` where
  `revoked_at IS NOT NULL` (old rows cannot tell rotation from logout, so they keep the replay
  detection they had); unrevoked rows stay `NULL`. `down` drops the column.

## `auth_sessions` dropped

**Decided: drop it** (implemented by #3, as Kerghan did).

**Why:** `TokenService#touchSession` inserts a new `auth_sessions` row on every token issuance
(login, register, refresh, winning device poll), and nothing ever reads the table: it is dead,
ever-growing data. Once a session is the refresh-token chain identified by `session_uuid`,
everything the table could tell is already there (`started_at`, the latest `issued_at`).

- Remove the `Session` entity (`backend/src/auth/entities/session.entity.ts`), its registration in
  `AuthModule`'s `TypeOrmModule.forFeature`, `TokenService#touchSession` and the
  `Repository<Session>` injection.
- Add a migration dropping `auth_sessions`. Its `down` recreates the **empty** table with the
  original shape (`id`, `user_id` + `idx_auth_sessions_user_id`, `created_at`, `last_seen_at`).
- Update the Auth module docs that mention the table in #7 (fold).

## User status

Implemented by #5.

```ts
// backend/src/auth/entities/user.entity.ts
export const UserStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
} as const;
export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

@Column({ type: 'varchar', length: 16 })
  status!: UserStatus;
```

- `auth_users.status varchar(16) NOT NULL`, with **no column default**. Every code path that
  creates a row (registration, seed migrations) sets it explicitly. **Why:** an implicit default
  could silently grant access (`approved`) or silently lock users out (`pending`).
- **Migration**: add the column nullable → `UPDATE auth_users SET status = 'approved'` → make it
  `NOT NULL`. `down` drops the column.
- **The `approved` backfill is kept** (decided), even though Citadel Placeholder is a template
  with no live users: a project built from it that already has users must not be locked out when
  it pulls this change. The backfill runs everywhere (not skipped in production) and covers the
  existing demo seed users, whose migrations run before this one.
- Seed migrations that run **after** this one must insert `status: 'approved'` explicitly.
- The status is **not** added to the `user` payload of the auth endpoints, which stays
  `{ id, username, email, isAdmin }`. It is exposed only to admins (admin user items,
  [api/admin.md](api/admin.md)) and as `status: "pending"` on `status.json`
  ([api/auth.md](api/auth.md)).
- `RevokedReason.ADMIN_DENIED` ships in the same sub-issue (see [Revoked reasons](#revoked-reasons)).

## Migration and deploy order

1. #3: sessions migration (`session_uuid`, `started_at`), revoked-reason migration, then the
   `auth_sessions` drop. Must be merged before the gate (#4), which reads `session_uuid`.
2. #4: no migration.
3. #5: the status migration ships in the **same deploy** as the gate's `user.status = 'approved'`
   condition ([gate.md](gate.md)). Shipping the condition without the backfill locks every
   existing user out; shipping the column without the condition leaves pending users
   authenticated.

## Reference

- [refresh-token.entity.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/entities/refresh-token.entity.ts)
- [user.entity.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/entities/user.entity.ts)
- [20261005120017-auth-add-refresh-tokens-session.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261005120017-auth-add-refresh-tokens-session.ts)
- [20261005120018-auth-add-refresh-tokens-revoked-reason.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261005120018-auth-add-refresh-tokens-revoked-reason.ts)
- [20261009120019-auth-drop-sessions.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261009120019-auth-drop-sessions.ts)
- [20261017120020-auth-add-users-status.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261017120020-auth-add-users-status.ts)
- [token.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/token.service.ts)
- [auth-add-users-status-migration.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/tests/auth-add-users-status-migration.spec.ts)

## Required tests

Sessions (#3):

- Sessions migration: `up` backfills every existing row with a distinct `session_uuid` and
  `started_at = issued_at`, then both columns are `NOT NULL`; `down` removes them.
- Revoked-reason migration: `up` sets `rotated` on revoked rows only; unrevoked rows stay `NULL`;
  `down` removes the column.
- `auth_sessions` drop migration: `up` drops the table; `down` recreates it empty.
- Login, register and a winning device poll each create a **new** `session_uuid`; two logins of
  the same user get two different sessions.
- `refresh.json` copies `session_uuid` and `started_at` to the replacement token.
- Each revocation site writes its reason (`rotated`, `logout`, `password_reset`,
  `replay_detected`).
- Replaying a `rotated` token revokes the user's active tokens with `replay_detected`; replaying a
  `logout` token answers `401` and revokes nothing else; an expired rotated token answers `401`
  without replay detection.
- A bulk revoke leaves already-revoked rows' reasons untouched.
- No `auth_sessions` write remains on any issuance path.

Status (#5):

- Status migration: `up` backfills every existing row (including the demo seeds) to `approved`,
  then the column is `NOT NULL` with no default; `down` drops it.
- Inserting a user without a status fails (no default).
- The auth endpoints' `user` payload has no `status` field.
