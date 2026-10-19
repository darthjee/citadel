# Session-lookup gate

Back to the [feature README](README.md).

Implemented by #4; #5 adds the `approved` requirement (see
[The gate requires `approved`](#the-gate-requires-approved)).

Today `JwtGuard` (`backend/src/core/jwt.guard.ts`) trusts the JWT claims until the access token
expires. Without a gate, a pending, denied, logged-out or demoted user still holding a valid
access token keeps working for up to the access-token TTL. The gate makes the user's **current DB
state** decide every authenticated request.

Valuable on its own, before any status logic: logout, password-reset revocations, replay
detection, admin deny and admin demotion all take effect on the **next request**, not after the
access-token TTL.

## The `sid` claim

The access-token payload (`backend/src/core/access-token-payload.ts`) becomes:

```json
{ "sub": 42, "sid": "6f1c2a0e-8a4b-4f3c-9d2e-1b7a5c3e9f10", "username": "alice", "isAdmin": false }
```

```ts
export interface AccessTokenPayload {
  sub: number;
  sid: string;
  username: string;
  isAdmin: boolean;
}
```

`sid` is the `sessionUuid` of the refresh-token row the access token was minted with
([model.md](model.md)). Every path that mints an access token goes through
`TokenService#issueTokens` (login, register, refresh, winning device poll), which sets it.
`username` and `isAdmin` stay in the token for the frontend's convenience, but the backend no
longer trusts them (see below).

## Tokens without `sid` are invalid

**Decided:** an access token without a `sid` claim is **simply invalid**, rejected like any other
invalid token. There is no transition path for pre-`sid` tokens.

**Why:** Citadel Placeholder is a template for future projects, with no live user base to
migrate. Even for a derived project that has users, the frontend's refresh-and-retry on `401`
(`ApiClient`) calls `refresh.json`, which mints a `sid`-bearing access token for the same session,
so the switch is invisible to users.

## The `SESSION_LOOKUP` port

`core/` never imports `auth/` ([backend architecture](../../architecture/backend.md)), so Core
owns an injection token and interface, and the Auth module provides the implementation:

```ts
// backend/src/core/session-lookup.ts
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');

export interface SessionUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

export interface SessionLookup {
  findActiveSessionUser(sid: string): Promise<SessionUser | null>;
}
```

```ts
// backend/src/auth/auth.module.ts
providers: [ /* … */ SessionService, { provide: SESSION_LOOKUP, useExisting: SessionService } ],
exports: [AuthService, SESSION_LOOKUP],
```

`SessionService#findActiveSessionUser` (new `backend/src/auth/session.service.ts`) is **one
indexed query** on `auth_refresh_tokens.session_uuid`:

```ts
this.userRepository
  .createQueryBuilder('user')
  .innerJoin(RefreshToken, 'session', 'session.userId = user.id')
  .select(['user.id', 'user.username', 'user.isAdmin'])
  .where('session.sessionUuid = :sid', { sid })
  .andWhere('session.revokedAt IS NULL')
  .andWhere('session.expiresAt > :now', { now: new Date() })
  .andWhere('user.status = :status', { status: UserStatus.APPROVED }) // added by #5
  .getOne();
```

This join stays inside the Auth module (both tables are `auth_` tables), so it does not break the
"no cross-module JOIN" rule. Tests use an in-memory `SessionLookup` double.

## `JwtGuard`

On every non-`@Public()` request:

1. Missing `access_token` cookie → `401 Missing access token` (unchanged; the only different
   message).
2. Signature / expiry check against the current and previous secret keys (unchanged).
3. **Validate claims**: `sid` must be a string holding a well-formed UUID, `sub` an integer.
   Otherwise → invalid token.
4. `findActiveSessionUser(sid)` must return a user, and `user.id === sub`. Otherwise → invalid
   token.
5. `request.user = { sub, sid, username, isAdmin }`, built from the **DB row**, not from the JWT
   claims.

Every rejection in steps 2–4 throws the **same** `UnauthorizedException('Invalid or expired access
token')`, producing the byte-for-byte identical `401` body described in [errors.md](errors.md). A
DB error propagates as `500`, never turned into a `401`.

`canActivate` becomes `async`, and `JwtGuard` gets `SESSION_LOOKUP` injected. The `APP_GUARD`
order in `AppModule` is unchanged (`OriginGuard`, then `JwtGuard`, then `AdminGuard`).

### `isAdmin` read fresh from the DB

**Decided:** `request.user` (including `isAdmin`) comes from the user row returned by the session
lookup, so `AdminGuard` and `@CurrentUser()` always see current values. A demoted admin loses
admin access (`403` from `AdminGuard`) on their **next request**, not after the access-token TTL.
`AdminGuard` itself is unchanged: it keeps reading `request.user.isAdmin`.

## The gate requires `approved`

Added by #5. The only change to the gate is the extra `user.status = 'approved'` condition in
`findActiveSessionUser`. That single line makes pending and denied users anonymous to **every**
business endpoint, with no per-endpoint checks: business endpoints never read the status
themselves. The flag never disables this condition ([config.md](config.md)).

A pending user keeps their session row; as soon as an admin approves, the **next** request with
the same access token passes. No new login is needed.

This condition must ship in the same deploy as the status migration's `approved` backfill
([model.md](model.md#migration-and-deploy-order)).

Authenticated endpoints that a pending user might expect to reach (`authorize.json`,
`mine.json`, `PATCH /auth/account.json`) also get the gate's `401`; that is intended.

## Side effects

With the gate, these take effect on the **next request** of every affected session:

| Event | Effect |
|---|---|
| Logout (`DELETE /auth/logoff.json`) | That session's access tokens get `401` (logout revokes every active row of the session, [model.md](model.md#sessions-on-refresh-tokens)) |
| Password reset | Every session of the user gets `401` |
| Replay detection | Every session of the user gets `401` |
| Admin deny ([api/admin.md](api/admin.md)) | Every session of the user gets `401` |
| Admin demotion (`is_admin` set to false — a DB change today, since no endpoint edits `isAdmin`) | `@AdminOnly()` routes answer `403` |

## Reference

- [jwt.guard.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/jwt.guard.ts)
- [session-lookup.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/session-lookup.ts)
- [access-token-payload.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/access-token-payload.ts)
- [session.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/session.service.ts)
- [token.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/token.service.ts)
- [auth.module.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/auth.module.ts)
- [in-memory-session-lookup.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/support/in-memory-session-lookup.ts) (test double)
- [auth.md → JWT/refresh-token flow](https://github.com/darthjee/kerghan/blob/main/docs/agents/modules/auth.md#jwtrefresh-token-flow)
- Kerghan commit [`3f3c691`](https://github.com/darthjee/kerghan/commit/3f3c691)

## Required tests

Mirroring Kerghan's
[jwt.guard.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/tests/jwt.guard.spec.ts),
[session.service.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/session.service.spec.ts)
and
[auth.controller.session-gate.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/auth.controller.session-gate.e2e-spec.ts).

`JwtGuard` (unit):

- A token whose `sid` maps to an active session of the same user passes, and `request.user` is
  built from the lookup's row (a JWT claiming `isAdmin: true` for a non-admin row yields
  `isAdmin: false`).
- Each of these answers the byte-for-byte identical `401`: no `sid`; `sid` not a UUID; `sub` not
  an integer; lookup returns `null`; lookup returns a user whose `id !== sub`; bad signature;
  expired token.
- A lookup that throws propagates as `500`.
- `@Public()` routes never call the lookup; a missing cookie answers `401 Missing access token`
  without calling it.
- A token signed with a previous secret key still goes through the session lookup (and fails it
  when the session is revoked).
- A `sid` belonging to another user's active session (`user.id !== sub`) → the identical `401`.

`SessionService#findActiveSessionUser`:

- Returns the user for an active session; `null` for an unknown, revoked or expired session.
- (#5) `null` for a `pending` or `denied` user's active session.

Session-gate e2e:

- After logout, the same access token gets `401` on a protected route.
- Two sessions of the same user: logging one out leaves the other's access token working.
- After a password reset, every other session's access token gets `401`.
- A demoted admin's next `@AdminOnly()` call answers `403`.
- `refresh.json` mints an access token whose `sid` equals the session's `session_uuid`.
- (#5) A pending user's access token gets the identical `401`; after approval the **same** token
  passes. A denied user's access token gets the identical `401`.
