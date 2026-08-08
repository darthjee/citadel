# Routes — Auth

Authentication and session management routes, served by two controllers under the `/auth`
prefix: `AuthController` (`auth/auth.controller.ts`, the four classic routes below — login,
register, refresh, logoff — all `@Public()`, since they exist to establish or renew credentials
and must be reachable without an already-valid access token) and
`AuthorizationRequestController` (`auth/authorization-request.controller.ts`, the five
device-authorization routes below — `create`/`poll` are `@Public()` for the same reason,
`mine`/`authorize`/`deny` require the default `JwtGuard`).

Business logic lives in `AuthService` (`auth/auth.service.ts`) for the four classic routes, and
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

`user` is `{ id, username, email }` — `passwordDigest` is never serialized.

### `POST /auth/register.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RegisterDto` — `{ username, password, email }` |
| Success response | `{ user, refreshToken }` + sets `access_token` cookie |
| HTTP status | `200` (default) |

Creates a new `auth_users` record, then issues tokens identically to login.

### `POST /auth/refresh.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RefreshTokenDto` — `{ refreshToken: string }` |
| Success response | `{ user, refreshToken }` + sets new `access_token` cookie |
| HTTP status | `200` (default) |

Rotates the refresh token server-side (old token's `revokedAt` is set).
Replay of a revoked or expired token is rejected with `401`.

### `DELETE /auth/logoff.json`

| Property | Value |
| --- | --- |
| Controller | `AuthController` |
| Auth | `@Public()` |
| Request body | `RefreshTokenDto` — `{ refreshToken: string }` |
| Success response | No body |
| HTTP status | `204 No Content` |

Revokes the refresh token server-side and clears the `access_token` cookie.

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
it. Only the first poll to claim an `approved` request mints a session — the winning response
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

All nine routes above (the four classic ones plus the five device-authorization ones) are
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
| `auth/auth.service.ts` | Business logic (login, register, refresh, logout) |
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
