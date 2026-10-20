# Auth — User approval

Optional admin approval of self-registered accounts, plus the session-lookup gate that makes an
account's **current** status decide every authenticated request. Part of the
[Auth module](../auth.md). The product decision behind it is recorded in
[product.md](../../product.md) ("User approval").

With the flag on, a self-registered account starts `pending` and cannot use the application
until an admin approves it. Admins can also **deny** any account: reject a pending one, or ban an
approved one. With the flag off (the default), registration starts accounts `approved`, but the
status gate and the admin review tools still exist.

Related pages, not duplicated here:

- [Auth module](../auth.md) — entities (`auth_users.status`, refresh-token sessions,
  `revoked_reason`), the JWT/refresh-token flow and the session-lookup gate.
- [Auth routes](../../backend/routes/auth.md) — per-endpoint behavior and error codes.
- [Admin routes](../../backend/routes/admin.md) — search filter, approve, deny.
- [Security](../../architecture/security.md#session-lookup-gate) — non-disclosure, races,
  accepted risks.
- [Frontend](../../architecture/frontend.md#user-approval) — pending state, awaiting-approval
  view, admin review UI.

## Statuses

`UserStatus` (`backend/src/auth/entities/user.entity.ts`), stored in `auth_users.status`:

| Status | Meaning |
|---|---|
| `pending` | Registered while approval was required; waiting for an admin |
| `approved` | Can use the application normally |
| `denied` | Rejected or banned; final |

```
          register (flag on)              register (flag off)
                 │                                │
                 ▼                                ▼
           ┌─────────┐        approve       ┌──────────┐
           │ pending │ ───────────────────▶ │ approved │
           └─────────┘                      └──────────┘
                 │                                │
            deny │                                │ deny (ban)
                 ▼                                ▼
           ┌──────────────────────────────────────────┐
           │                  denied                  │ ◀── deny again: allowed
           └──────────────────────────────────────────┘     (still revokes sessions)
```

## Rules

- **Only `approved` users are authenticated.** `SessionService#findActiveSessionUser` only
  resolves sessions of `approved` users, so `JwtGuard` answers the gate's identical `401` to
  pending and denied users on **every** non-`@Public()` route, whatever the flag. Business
  endpoints never read the status themselves.
- **approve** is strict: only from `pending` (anything else → `422 USER_NOT_PENDING`). It is a
  conditional update, so it never overwrites a concurrent deny.
- **deny** is lenient: from **any** status, including `denied`, so it covers both "reject" and
  "ban". It revokes every active refresh token of the user with `admin_denied`.
- **`denied` is final**: no endpoint leaves it; only a manual DB change can.
- The status changes **only** through approve and deny. Admin edit, My Account, password reset
  and every other write path never touch it.
- The status is **not** in the auth endpoints' `user` payload (`{ id, username, email, isAdmin }`).
  Only admins see it (admin user items), and `status.json` reports `status: "pending"` to the
  holder of a pending session.

## Configuration

| Env var | Default | Read by |
|---|---|---|
| `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` | off | `UserApprovalConfig` (`backend/src/auth/user-approval.config.ts`), once at boot |

- Exactly `true` turns it on; anything else (unset, empty, `TRUE`, `1`, …) leaves it off.
- It decides **only** the initial status of a new self-registration
  (`UserApprovalConfig#registrationStatus()`): `pending` when on, `approved` when off.
- It **never** changes existing users when toggled, **never** disables the gate's `approved`
  requirement and **never** hides the admin review tools.
- It is not exposed to the frontend, which learns about a pending account only through
  `status.json`.

`UserApprovalConfig` is built by a factory provider in `AuthModule` and injected into
`AuthService`; no service reads the variable directly. See
[environment-variables.md](../../environment-variables.md).

## What each endpoint does per status

Only these `@Public()` endpoints look at the real status, because the gate does not cover them.
Full detail in [Auth routes](../../backend/routes/auth.md).

| Endpoint | `pending` | `denied` |
|---|---|---|
| `POST /auth/login.json` | Normal `200` with a session (blocked by the gate until approval) | Correct password → `403 USER_DENIED`, no session; wrong password → the usual `401` |
| `POST /auth/register.json` | Created `pending` when the flag is on; same response as `approved` | Username/email of a denied account → the existing `409` |
| `POST /auth/status.json` | `{ loggedIn: false, isAdmin: false, status: "pending" }`, session kept | The anonymous answer; the presented token is revoked with `admin_denied` |
| `POST /auth/refresh.json` | Rotates normally | Presented token revoked with `admin_denied`, `401`, no replay detection |
| `POST /auth/recover.json` | Normal (token + email) | Treated like an unknown email: `200 { sent: true }`, no token, no event |
| `POST /auth/reset-password.json` | Works; the user stays `pending` | Same `400 Invalid or expired token` as an unknown token, before hashing; token not consumed |
| `POST /auth/authorization-requests/:uuid/poll.json` | Winning poll → `{ status: "denied" }`, no session | Same |

Authenticated endpoints a pending user might expect to reach (`authorize.json`, `mine.json`,
`PATCH /auth/account.json`) get the gate's `401`; that is intended.

## Admin review

The admin users page (frontend) and `AdminController` (`/admin` prefix, `@AdminOnly()`) always
expose the review tools, whatever the flag. See [Admin routes](../../backend/routes/admin.md):

- `POST /admin/users/search.json` takes an optional `status` filter (ANDed with `q`), returns
  `status` on every user and the caller's own `currentUserId`.
- `POST /admin/users/:id/approve.json` approves a `pending` user. Sessions are untouched: the
  user's existing session passes the gate on its next request.
- `POST /admin/users/:id/deny.json` denies any user but the caller (`422 CANNOT_DENY_SELF`) and
  logs them out everywhere. **Admins may deny other admins.**

## Lifecycle edge cases

1. **A pending user keeps their session.** Login and register give a pending user a real
   session; the gate blocks its access tokens. As soon as an admin approves, the **next** request
   with the same access token passes, with no new login.
2. **A pending user's refresh token expires while waiting.** `status.json` answers anonymously;
   they log in again (login works for pending users) and land back on the awaiting-approval view.
3. **Toggling the flag never changes existing users.** Turning it off does not approve pending
   users; turning it on does not make approved users pending.
4. **A denied account keeps its username and email.** The row is never deleted, so registering
   again with the same username or email gets the existing `409 USERNAME_TAKEN` /
   `EMAIL_TAKEN`. It discloses nothing that registration does not already disclose.
5. **An admin denied or demoted while on the admin page.** Their next admin call answers the
   gate's `401` (denied) or `AdminGuard`'s `403` (demoted, since `isAdmin` is read from the DB on
   every request).

## Migration

`database/migrations/20261019120014-auth-add-users-status.ts` adds `auth_users.status
varchar(16) NOT NULL` with **no column default**: it adds the column nullable, backfills every
existing row to `approved`, then makes it `NOT NULL`. Every code path that creates a user sets the
status explicitly, so an implicit default can never silently grant or deny access. The backfill
is kept even though the template has no live users, so a derived project that already has users
is not locked out when it pulls the change. Seed migrations running after it must insert
`status: 'approved'` explicitly.

## Reference

Ported from Kerghan's user-approval flow:

- Kerghan feature page:
  [modules/auth/user-approval.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/modules/auth/user-approval.md)
- Kerghan epic [#389](https://github.com/darthjee/kerghan/issues/389) and docs fold
  [#394](https://github.com/darthjee/kerghan/issues/394)
- Kerghan commits:
  [`3f3c691`](https://github.com/darthjee/kerghan/commit/3f3c691) (session-lookup gate),
  [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e) (user side),
  [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e) (admin side),
  [`0314aa9`](https://github.com/darthjee/kerghan/commit/0314aa9) (docs folded)
- Citadel epic [#1](https://github.com/darthjee/citadel/issues/1)

Citadel adaptations: the refresh token travels in the request body and lives in `localStorage`
(no cookie), there is no default user, and env vars use the `CITADEL_PLACEHOLDER_` prefix.
