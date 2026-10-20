# Routes — Auth

Authentication and session management routes, served by two controllers under the `/auth`
prefix: `AuthController` (`auth/auth.controller.ts`, the classic routes below — login,
register, refresh, logoff, status, recover, reset-password — all `@Public()`, since they exist to
establish, renew or check credentials and must be reachable without an already-valid access
token; plus the authenticated `PATCH /auth/account.json`) and
`AuthorizationRequestController` (`auth/authorization-request.controller.ts`, the five
device-authorization routes below — `create`/`poll` are `@Public()` for the same reason,
`mine`/`authorize`/`deny` require the default `JwtGuard`).

Business logic lives in `AuthService` (`auth/auth.service.ts`) for the classic routes
(`status.json` in `SessionStatusService`, recover/reset in `PasswordResetService`), and
`AuthorizationRequestService` (`auth/authorization-request.service.ts`) for the five
device-authorization routes; both controllers are thin delegation layers.

## Endpoints

### `POST /auth/login.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `LoginDto` — `{ username: string, password: string }` |
| Success response | `{ user, refreshToken }` + sets `access_token` cookie |
| HTTP status | `200` (default) |

`user` is `{ id, username, email, isAdmin }` — `passwordDigest` and the account `status` are
never serialized.

| Case | Answer |
| --- | --- |
| Unknown username or wrong password (any status) | `401 Invalid username or password` |
| Correct password, user `denied` | `403 USER_DENIED` — `This account has been denied access`; no session, no cookie, no refresh token |
| Correct password, user `pending` | `200` with a session, identical to an approved login (its access tokens are blocked by the gate until approval) |
| Correct password, user `approved` | `200` |

The status is checked only after the password, so it cannot be probed without the password. A
`403` never triggers the frontend `ApiClient`'s refresh-and-retry.

### `POST /auth/register.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RegisterDto` — `{ username, password, email }` |
| Success response | `{ user, refreshToken }` + sets `access_token` cookie |
| HTTP status | `200` (default) |

Creates a new `auth_users` record, then issues tokens identically to login. The new row's
`status` comes from `UserApprovalConfig#registrationStatus()`: `pending` when
`CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` is exactly `true`, `approved` otherwise. The response
is identical for both: a pending user gets a real session that the gate blocks until approval.
A username or email already taken (including by a denied account, whose row is kept) answers
`409 USERNAME_TAKEN` / `EMAIL_TAKEN`.

### `POST /auth/refresh.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RefreshTokenDto` — `{ refreshToken: string }` |
| Success response | `{ user, refreshToken }` + sets new `access_token` cookie |
| HTTP status | `200` (default) |

Rotates the refresh token within its session, atomically and single-winner (see
`docs/agents/modules/auth.md`'s "JWT/refresh-token flow"). Check order:

1. Unknown or expired token → `401 Invalid or expired refresh token`.
2. Revoked `rotated` → replay detection (every active token of the user revoked with
   `replay_detected`), then `401`.
3. Revoked for any other reason (`logout`, `password_reset`, `replay_detected`,
   `admin_denied`) → plain `401`.
4. Still active, user `denied` → the presented token is revoked with `admin_denied`, `401`, no
   replay detection.
5. Still active, user `pending` or `approved` → rotated (`rotated` on the presented token,
   session copied onto the new one). A concurrent refresh that lost the rotation → `401`.

### `DELETE /auth/logoff.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RefreshTokenDto` — `{ refreshToken: string }` |
| Success response | No body |
| HTTP status | `204 No Content` |

Revokes every active refresh token of the presented token's session with `logout` (even when
the presented token itself was already rotated) and clears the `access_token` cookie. Unchanged
for every status.

### `POST /auth/status.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` (delegates to `SessionStatusService`) |
| Auth | `@Public()` |
| Request body | `RefreshTokenDto` — `{ refreshToken: string }` |
| Success response | `{ loggedIn, isAdmin }`, plus `status: 'pending'` for a pending user only |
| HTTP status | `200` (default), always |

| Caller | Response body | Session |
| --- | --- | --- |
| Active session, `approved` | `{ "loggedIn": true, "isAdmin": <bool> }` | kept |
| Active session, `pending` | `{ "loggedIn": false, "isAdmin": false, "status": "pending" }` | **kept** |
| Active session, `denied` | `{ "loggedIn": false, "isAdmin": false }` — byte-for-byte the anonymous answer | the presented token is revoked with `admin_denied` |
| Unknown, revoked or expired token | `{ "loggedIn": false, "isAdmin": false }` | — |

Passive otherwise: no rotation, no replay detection, and the `access_token` cookie is not
touched, so a second tab's check never logs the first one out. The pending answer is the one
`loggedIn: false` answer whose session the frontend keeps.

### `POST /auth/recover.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` (delegates to `PasswordResetService#recover`) |
| Auth | `@Public()` |
| Request body | `RecoverDto` — `{ email: string }` |
| Success response | `{ sent: true }` |
| HTTP status | `200`, always |

`approved` / `pending` user: a single-use reset token is minted and the
`password-recovery.requested` event fires. Unknown email or `denied` user: no token, no event,
the same log line and the same response. Response time is not equalised (see
`docs/agents/architecture/security.md`).

### `POST /auth/reset-password.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` (delegates to `AuthService#resetPassword`) |
| Auth | `@Public()` |
| Request body | `ResetPasswordDto` — `{ token: string, password: string }` |
| Success response | `{ reset: true }` |
| HTTP status | `200`; `400 Invalid or expired token` on any rejection |

Unknown, used or expired token → `400`. A valid token of a `denied` (or missing) user → the same
`400`, checked **before** hashing the new password, and the token is not consumed. Otherwise the
password is changed, the token marked used, and every active refresh token of the user revoked
with `password_reset`; a `pending` user stays `pending`.

### `POST /auth/authorization-requests.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | `@Public()` |
| Request body | `CreateAuthorizationRequestDto` — `{ username: string }` |
| Success response | `{ uuid, pollToken, expiresAt }` |
| HTTP status | `200` (default) |

Creates a device-authorization request. Responds identically whether or not `username` matches a
real account (enumeration safety) — see `docs/agents/modules/auth.md`'s "Device-authorization
flow" for the full enumeration-safety and rate-limit contract. `pollToken` is returned once here
and never stored (only its SHA-256 hash is persisted).

### `POST /auth/authorization-requests/:uuid/poll.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | `@Public()` |
| Request body | `PollAuthorizationRequestDto` — `{ pollToken: string }` |
| Success response | `{ status }`; on the winning `approved` poll: `{ status: 'approved', user, refreshToken }` + sets `access_token` cookie |
| HTTP status | `200` (default); `404` on an unknown `uuid` or a `pollToken` that doesn't hash-match |

An `open` request past its `expiresAt` is lazily flipped to `expired` on the poll that observes
it. On the winning poll the requester is reloaded: if they are not `approved` (pending or
denied), the request moves `logged → denied` and the poll answers `{ status: 'denied' }` — the
same answer as a request the approver denied — with no session and no cookie. `create` stays
identical for every status. Only the first poll to claim an `approved` request mints a session — the winning response
reuses `respondWithSession` (see "Access token cookie" below), the same session shape as
login/register/refresh. Every other poll of an already-claimed request gets `{ status: 'logged'
}`, no credentials.

### `POST /auth/authorization-requests/mine.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | — |
| Success response | `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt }] }` |
| HTTP status | `200` (default) |

Lists the caller's own `open`, non-expired authorization requests, newest first. The caller's id
comes from `req.user.sub`, populated by `JwtGuard`.

### `POST /auth/authorization-requests/:uuid/authorize.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | `AuthorizeAuthorizationRequestDto` — `{ password: string }` |
| Success response | `{ authorized: true }` |
| HTTP status | `200` (default); `400 Bad Request` on any business rejection |

Re-verifies the caller's own current password before approving a request raised against their
own username. Every business rejection — missing row, wrong owner, wrong status, expired, wrong
password, or locked out by the cool-off guard — collapses into the same `400`, never `401`/`403`,
so `ApiClient`'s refresh-and-retry logic is never triggered by a business rejection.

### `POST /auth/authorization-requests/:uuid/deny.json`

| Property | Value |
| --- | --- |
| Controller | `AuthorizationRequestController` |
| Auth | Default `JwtGuard` (authenticated, no `@AdminOnly()`) |
| Request body | — |
| Success response | `{ denied: true }` |
| HTTP status | `200` (default); `400 Bad Request` on any business rejection |

Same ownership/status rejection shape as `authorize`, but no password is required.

## Shared behavior

### Gate `401`

Every non-`@Public()` route (`account.json`, `mine.json`, `authorize.json`, `deny.json`) goes
through `JwtGuard`'s session-lookup gate. Every gate rejection — bad signature, expired token,
malformed claims, token without `sid`, revoked or expired session, session of another user, or a
`pending` / `denied` user — answers the **same** body, byte-for-byte apart from `timestamp`:

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired access token" },
  "statusCode": 401,
  "timestamp": "<ISO 8601>"
}
```

A missing `access_token` cookie answers `401 Missing access token`; a DB error during the lookup
stays a `500` (`INTERNAL_ERROR`).

### Error codes

User-approval error codes (`core/error-codes.ts`), each message exported as a constant next to
its throw site:

| Code | HTTP | Message | Thrown by |
| --- | --- | --- | --- |
| `USER_DENIED` | `403` | `This account has been denied access` | `login.json`, correct password on a `denied` user |
| `USER_NOT_PENDING` | `422` | `Only pending users can be approved` | `POST /admin/users/:id/approve.json` (see [Admin routes](admin.md)) |
| `CANNOT_DENY_SELF` | `422` | `You cannot deny your own account` | `POST /admin/users/:id/deny.json` (see [Admin routes](admin.md)) |

### Cache policy

All the routes above are
declared `@CachePolicy(CacheClass.Never)` at controller level, so they send
`X-Skip-Cache: true` and `Cache-Control: no-store` on the response. Tent's
`default_proxy` rule caches any 2xx `*.json` response keyed only by query
string, regardless of HTTP method — since these POST routes carry no
query string, an uncapped response could otherwise be cached after the
first login/register/refresh/authorization-request call and served verbatim (credentials
included) to a different caller.

See [API Caching](../../architecture/caching.md) for the general strategy.

## Access token cookie

The winning `POST /auth/authorization-requests/:uuid/poll.json` response sets this cookie the
same way login/register/refresh do — both paths go through the shared `respondWithSession`
helper (`auth/auth-response.ts`), so the two response bodies/cookies cannot drift apart. It is
set with:

- `httpOnly: true` — not accessible via JavaScript
- `secure: true` — only sent over HTTPS
- `sameSite: 'strict'` — not sent on cross-site requests
- `maxAge`: `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` (default 15 minutes when unset — matches JWT expiry;
  see `docs/agents/environment-variables.md`)

The token is never returned in the response body — only the `refreshToken`
is, as it must be stored client-side to call `/auth/refresh.json` and
`/auth/logoff.json`.

## Source files

| File | Role |
| --- | --- |
| `auth/auth.controller.ts` | Route definitions, cookie/header setup |
| `auth/auth.service.ts` | Business logic (login, register, refresh, logout, reset delegation) |
| `auth/session-status.service.ts` | `status.json` answer |
| `auth/password-reset.service.ts` | Recover / reset-password business logic |
| `auth/user-approval.config.ts` | `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` → registration status |
| `auth/dto/login.dto.ts` | `LoginDto` validation |
| `auth/dto/register.dto.ts` | `RegisterDto` validation |
| `auth/dto/refresh-token.dto.ts` | `RefreshTokenDto` validation |
| `auth/authorization-request.controller.ts` | Device-authorization route definitions, cookie/header setup |
| `auth/authorization-request.service.ts` | Device-authorization business logic (create, poll, listOpenForUser, authorize, deny) |
| `auth/authorization-request-abuse-guard.service.ts` | Rate-limit/cap/cool-off hardening logic |
| `auth/entities/authorization-request.entity.ts` | `AuthorizationRequest` entity (`auth_authorization_requests`) |
| `auth/dto/create-authorization-request.dto.ts` | `CreateAuthorizationRequestDto` validation |
| `auth/dto/poll-authorization-request.dto.ts` | `PollAuthorizationRequestDto` validation |
| `auth/dto/authorize-authorization-request.dto.ts` | `AuthorizeAuthorizationRequestDto` validation |
