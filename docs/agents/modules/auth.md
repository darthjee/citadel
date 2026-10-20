# Module — Auth

Citadel Placeholder's first backend module, and its only **always-on** module (imported directly into
`AppModule` — see `docs/agents/architecture/modular-pattern.md`'s classification). Owns
Citadel Placeholder's lightweight per-user login (username/password — see
`docs/agents/product.md`). Ported from the pre-migration Express `Authenticator`/`Registrar`/
`UserSerializer` (`backend/lib/accounts/`, `backend/lib/serializers/`, now removed).

## Routes

See [Auth routes](../backend/routes/auth.md) for the full per-endpoint reference (request/response
detail, HTTP status, source files).

All routes are `@Public()` (exempt from the global `JwtGuard`) and end in `.json`, per Tent's
routing convention (`docs/agents/architecture/backend.md`):

| Route | Body | Response |
|---|---|---|
| `POST /auth/login.json` | `{ username, password }` | `{ user, refreshToken }` + `access_token` cookie |
| `POST /auth/register.json` | `{ username, email, password }` | `{ user, refreshToken }` + `access_token` cookie |
| `POST /auth/refresh.json` | `{ refreshToken }` | `{ user, refreshToken }` + `access_token` cookie |
| `DELETE /auth/logoff.json` | `{ refreshToken }` | `204 No Content`, clears the `access_token` cookie |
| `POST /auth/status.json` | `{ refreshToken }` | `{ loggedIn, isAdmin }`, plus `status: "pending"` for a pending user |

`user` is always `{ id, username, email, isAdmin }` — `passwordDigest` and the account `status`
are never serialized. `isAdmin` is the only way the frontend can learn whether the logged-in
user is an admin, since the `access_token` cookie is `httpOnly`. `/auth/status.json`
(`SessionStatusService`) resolves `isAdmin` from the token row's user when `loggedIn` is `true`,
and it is always `false` when `loggedIn` is `false`.

Login, register, status, refresh, recover/reset and the device-authorization poll answer
differently for `pending` and `denied` users (for example `403 USER_DENIED` on a denied user's
correct-password login, or `{ loggedIn: false, isAdmin: false, status: "pending" }` from
`status.json`) — see [User approval](auth/user-approval.md#what-each-endpoint-does-per-status)
and [Auth routes](../backend/routes/auth.md).

### Admin tool routes (`AdminController`, `/admin` prefix)

Every route below requires the default `JwtGuard` behavior (no `@Public()`) plus `@AdminOnly()`
(applied once at the controller level) — see "Admin authorization" below for what that enforces.
All six are `@CachePolicy(CacheClass.Never)` (controller level), so they send
`X-Skip-Cache: true` and `Cache-Control: no-store`, for the same cross-caller-caching reason as
the routes above. See [Admin routes](../backend/routes/admin.md) for the full per-endpoint
reference.

| Route | Body | Response |
|---|---|---|
| `POST /admin/users/search.json` | `{ q?, status? }` | `{ users: [adminUser], currentUserId }` |
| `POST /admin/users/:id/edit.json` | `{ username?, email?, newPassword? }` | `{ user: adminUser }` |
| `POST /admin/users/:id/approve.json` | — | `{ user: adminUser }` |
| `POST /admin/users/:id/deny.json` | — | `{ user: adminUser }` |
| `POST /admin/users/:id/recovery-link.json` | — | `{ resetUrl }` |
| `POST /admin/users/:id/send-recovery-email.json` | — | `{ sent }` |

`adminUser` is `{ id, username, email, isAdmin, createdAt, status }`, built by
`AdminController`'s own serializer (never the shared auth `user` payload, which has no
`status`).

`search.json` matches `q` case-insensitively against `username`/`email` (TypeORM `ILike` on
both, `where: [...]`) and, when `status` is given (`pending`/`approved`/`denied`, validated by
`SearchUsersDto`), ANDs it with each branch; with neither, it returns every account,
unpaginated. `currentUserId` is the caller's own id, so the admin page can hide deny on the
admin's own row. `approve.json` moves a `pending` user to `approved` (`422 USER_NOT_PENDING`
otherwise); `deny.json` moves any user but the caller to `denied` (`422 CANNOT_DENY_SELF` on
the caller's own id) and revokes every active refresh token of that user with `admin_denied` —
see [User approval](auth/user-approval.md). The recovery-link and send-recovery-email
routes both mint a fresh `PasswordResetToken` via `PasswordResetService#issueToken` (shared with
self-service `recover()`) for the given `:id`, never invalidating that user's other outstanding
tokens, and `404`s when `:id` doesn't match an account. `send-recovery-email.json` additionally
calls `MailService.sendEmailTemplate(...)` directly and synchronously (not the fire-and-forget
`password-recovery.requested` event self-service uses), so the admin gets a real
`sent: true`/`false` result instead of a always-`true` response — `sent: false` covers both a
disabled mail transport and a thrown send error, never a `500`.

Every `AuthController` route is `@CachePolicy(CacheClass.Never)` (controller level), so they send
`X-Skip-Cache: true` and `Cache-Control: no-store` on the response. Tent's `default_proxy` rule
caches any 2xx `*.json` response keyed only by query string, regardless of HTTP method — since
these POST routes carry no query string, an uncapped response could otherwise be cached after
the first login/register/refresh and served verbatim (credentials/session token included) to a
different caller. See [API Caching](../architecture/caching.md) for the general strategy.

## CSRF protection

Every mutating route above (`POST`/`PATCH`/`DELETE`), `@Public()` or not, is covered by the
global `OriginGuard` (`core/origin.guard.ts`), which runs before `JwtGuard` and rejects
cross-site requests with `403` based on `Sec-Fetch-Site`/`Origin`. Together with the
`SameSite=Strict` `access_token` cookie, this also blocks login CSRF on the unauthenticated
routes (`login.json`, `register.json`, `recover.json`, `reset-password.json`, `refresh.json`,
`status.json`, the device-authorization `create`/`poll`). See
[`docs/agents/architecture/security.md`](../architecture/security.md#csrf) for the full decision
table, the accepted residual risks and the rules future changes must keep.

## Entities (`auth_` table prefix)

- `auth_users` (`entities/user.entity.ts`) — `id`, `username` (unique), `email` (unique),
  `passwordDigest`, `isAdmin` (boolean, default `false`), `status` (`UserStatus`: `pending` /
  `approved` / `denied`, `varchar(16) NOT NULL` with **no default**, so every write path sets it
  explicitly; existing rows were backfilled to `approved` by
  `20261019120014-auth-add-users-status.ts` — see [User approval](auth/user-approval.md)),
  `createdAt`, `updatedAt`.
- `auth_refresh_tokens` (`entities/refresh-token.entity.ts`) — `id`, `tokenHash` (SHA-256 of the
  token, unique — the plaintext value is returned to the client once and never stored),
  `userId` (logical FK), `issuedAt`, `expiresAt`, `revokedAt`, `revokedReason`, `sessionUuid`
  (indexed, `idx_auth_refresh_tokens_session_uuid`) and `startedAt`. A **session** is one chain
  of rotated refresh tokens sharing the same `sessionUuid`/`startedAt`; see
  "JWT/refresh-token flow" below. `revokedAt` and `revokedReason` are always set together;
  `RevokedReason` is exported next to the entity:

  | Reason | Written by |
  |---|---|
  | `rotated` | `refresh.json`, on the presented token |
  | `logout` | `DELETE /auth/logoff.json`, on every active token of the presented token's session |
  | `password_reset` | `reset-password.json`, on every active token of the user |
  | `replay_detected` | Replay detection in `refresh.json`, on every active token of the user |
  | `admin_denied` | `POST /admin/users/:id/deny.json` (every active token of the user), and the `refresh.json` / `status.json` re-checks of a denied user (the presented token) |

  Bulk revokes only touch active rows (`revoked_at IS NULL`), so already-revoked rows keep their
  original reason as replay evidence.

  The former `auth_sessions` table (written on every issuance, never read) was dropped by
  `20261018120013-auth-drop-sessions.ts`; the refresh-token chain replaces it.
- `auth_authorization_requests` (`entities/authorization-request.entity.ts`) — see
  "Device-authorization flow" below for the full contract.

A dev/manual-testing demo user (`demo`/`citadel-placeholder-demo`) is seeded by
`database/migrations/20260824120004-auth-seed-demo-user.ts`, gated on `process.env.STAGE !==
'production'` so it can never be created if `yarn migration:run` is ever pointed at a production
database. The password comes from `CITADEL_PLACEHOLDER_DEMO_PASSWORD` (see
`docs/agents/environment-variables.md`), set to `citadel-placeholder-demo` in `.env.dev.sample` — if that
var is unset the migration falls back to `citadel-placeholder-demo-placeholder`, which is **not** a working
login for the documented demo credentials, it only exists so the real password never lives in
source. A follow-on dev-only migration
(`database/migrations/20260903120007-auth-promote-demo-user-admin.ts`), also gated on
`process.env.STAGE === 'production'`, promotes the seeded `demo` user to admin so admin-only
tooling stays exercisable out of the box locally — it has to be a separate, later migration
rather than an edit to the seed migration's `INSERT`, since the seed migration runs before
`is_admin` exists on a fresh database.

## JWT/refresh-token flow

- **Access token**: JWT (`@nestjs/jwt`), signed with `CITADEL_PLACEHOLDER_SECRET_KEY` (via `ConfigService`,
  never read directly). `JwtGuard` verifies against the current key first, then each retired
  key in `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS` (resolved by `core/secret-keys.ts`), so the key can be
  rotated without logging users out — see the rotation runbook in
  `docs/agents/environment-variables.md`. Expiry is configurable via `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` (milliseconds;
  defaults to `900000`, 15 minutes, when unset) — see `docs/agents/environment-variables.md`. Set
  as an `httpOnly` + `Secure` + `SameSite=Strict` cookie (`access_token`), whose `maxAge` is
  driven by the same env var — never returned in the response body. The payload
  (`core/access-token-payload.ts`'s `AccessTokenPayload`) is `{ sub, sid, username, isAdmin }`:
  `sid` is the `sessionUuid` of the refresh-token row the token was minted with (set by
  `TokenService#issueTokens` on login, register, refresh and a winning device poll).
  `username`/`isAdmin` are informational for the frontend; the backend does not trust them (see
  "Session-lookup gate" below).
- **Refresh token**: a random 48-byte hex string, 7 day expiry, returned in the response body
  and persisted only as a SHA-256 hash. Login, register and a winning device poll each start a
  **new session** (`randomUUID()`, `startedAt = now`). **Rotated on every use**:
  `POST /auth/refresh.json` (`TokenService#rotateTokens`) copies the session onto the
  replacement token, in **one transaction**: it inserts the replacement first, then revokes the
  presented row with `rotated` through a conditional update (`WHERE id = ? AND revoked_at IS
  NULL`). If that affects no row, a concurrent refresh already won: the transaction rolls back
  and the loser gets `401`, so a session never forks and has at most one active row. Check
  order: unknown or **expired** → `401`; revoked `rotated` → replay detection (every active
  token of the user is revoked with `replay_detected`) then `401`; revoked for any other reason
  → plain `401`; a denied user's still-active token → revoked with `admin_denied`, `401`. Only
  `rotated` triggers replay detection.
- **Logout ends the whole session**: `DELETE /auth/logoff.json` resolves the presented token's
  `sessionUuid` (whatever the token's own state, so a stale rotated token still works), revokes
  every active row of that session with `logout`, and clears the `access_token` cookie. Other
  sessions of the user are untouched. Through the gate below, the session's access tokens stop
  working on their next request.
- **Registration also logs in**: `POST /auth/register.json` issues a token pair immediately on
  success, same as login/refresh (per the issue's "issued on login/register/refresh" flow) —
  there's no separate "register, then log in" round trip.

### Session-lookup gate

`JwtGuard` (`core/jwt.guard.ts`) makes the user's **current DB state** decide every
non-`@Public()` request:

1. Missing `access_token` cookie → `401 Missing access token`.
2. Signature/expiry check against the current and previous secret keys.
3. Claims: `sid` must be a well-formed UUID string and `sub` an integer. An access token without
   `sid` is simply invalid; there is no transition path.
4. `findActiveSessionUser(sid)` (through the Core-owned `SESSION_LOOKUP` port,
   `core/session-lookup.ts`) must return a user with `id === sub`.
5. `request.user = { sub, sid, username, isAdmin }`, with `username`/`isAdmin` from the **DB
   row**, not from the JWT claims.

Every rejection in steps 2–4 answers the same `401 Invalid or expired access token`; a lookup
error propagates as `500`, never a misleading `401`.

`core/` never imports `auth/`, so Core owns the `SESSION_LOOKUP` token and `SessionLookup`
interface, and `AuthModule` provides the implementation (`{ provide: SESSION_LOOKUP,
useExisting: SessionService }`, exported). `SessionService#findActiveSessionUser`
(`auth/session.service.ts`) is one indexed query: `auth_users` joined to `auth_refresh_tokens`
on `session_uuid`, requiring the row to be unrevoked and unexpired and the user to be
**`approved`** — an in-module join, so it does not break the no-cross-module-JOIN rule. That
single condition makes pending and denied users anonymous to every business endpoint (see
[User approval](auth/user-approval.md)).

With the gate, these take effect on the **next request** of every affected session, not after
the access-token TTL:

| Event | Effect |
|---|---|
| Logout | That session's access tokens get `401` |
| Password reset | Every session of the user gets `401` |
| Replay detection | Every session of the user gets `401` |
| Admin deny | Every session of the user gets `401` |
| Admin demotion (`is_admin` set to false — a DB change, no endpoint edits it) | `@AdminOnly()` routes answer `403` |
| Admin approve | A pending user's existing access token starts passing |

Cost: one indexed DB lookup per authenticated request, accepted as the price of immediate
revocation (see [Security](../architecture/security.md#session-lookup-gate)).

## Device-authorization flow

A second way to log in, alongside the JWT/refresh-token flow above: a not-yet-logged-in device
(the "requester") asks an already-logged-in device (the "approver", same account) to vouch for a
username, then polls until that device approves or denies it. The frontend's login modal
(`LoginModal`) is the single entry point for this — standalone login/register pages no longer
exist; the requester picks the "authorize with a logged-in device" mode instead of typing a
password — see `docs/agents/architecture/frontend.md`'s "Auth flow" section for the frontend side.

### Entity

`auth_authorization_requests` (`entities/authorization-request.entity.ts`), owned by this module:
`uuid` (unique, public identifier), `username` (as typed by the requester), `userId` (logical FK
into `auth_users`, `NULL` when `username` didn't resolve to a real user — such a row can never be
approved), `status` (the state machine below), `pollTokenHash` (unique, SHA-256 of the poll
token), `requestIp`/`requestUserAgent` (captured at creation), `approvedByUserId`, `createdAt`/
`expiresAt`/`resolvedAt`/`loggedAt`, and the hardening columns `authorizeFailedAttempts`/
`authorizeLockedUntil` (see "Hardening limits" below).

### Device-authorization routes

Same compact-table convention as "Routes" above — see [Auth routes](../backend/routes/auth.md)
for the full per-endpoint reference. Unlike the four classic routes, only `create`/`poll` are
`@Public()`; `mine`/`authorize`/`deny` require the default `JwtGuard` (the first non-admin
authenticated routes in the codebase), with the caller's own user id read from `req.user.sub`.

| Route | Auth | Body | Response |
|---|---|---|---|
| `POST /auth/authorization-requests.json` | `@Public()` | `{ username }` | `{ uuid, pollToken, expiresAt }` |
| `POST /auth/authorization-requests/:uuid/poll.json` | `@Public()` | `{ pollToken }` | `{ status }`, plus `user`/`refreshToken` + the `access_token` cookie on the winning `approved` poll |
| `POST /auth/authorization-requests/mine.json` | `JwtGuard` | — | `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt }] }` |
| `POST /auth/authorization-requests/:uuid/authorize.json` | `JwtGuard` | `{ password }` | `{ authorized: true }` |
| `POST /auth/authorization-requests/:uuid/deny.json` | `JwtGuard` | — | `{ denied: true }` |

`authorize`/`deny` collapse every business rejection (missing row, wrong owner, wrong status,
expired, wrong password, locked out) into the same `400 Bad Request` — never `401`/`403` — so
`ApiClient`'s refresh-and-retry logic is never triggered by a business rejection, only by an
actually-expired session.

### Status machine

`open → approved → logged` is the success path: `authorize` moves a request to `approved`, and
the winning poll claims it atomically (a guarded `UPDATE ... WHERE status = 'approved'`, so only
the first poll to observe `approved` can flip it to `logged` and mint a session — every other,
losing poll — including the requester's own next tick after that — gets back `{ status: 'logged'
}` with no credentials). `open → denied` covers an explicit `deny`. `open → expired` covers lazy
expiry (an `open` poll past its `expiresAt`) and the abuse-guard's open-cap eviction (see
"Hardening limits" below) — both flip an `open` row straight to `expired` without ever visiting
`approved`.

### Poll-token contract

Mirrors refresh-token hashing: `create` mints a random poll token, returns it once in the
response body, and persists only its SHA-256 hash (`pollTokenHash`). A poll with an unknown
`uuid` or a `pollToken` that doesn't hash-match is indistinguishable — both `404`.

### Enumeration safety

`create` always responds with the same `{ uuid, pollToken, expiresAt }` shape and does the same
work regardless of whether `username` resolves to a real user — a non-matching username still
gets a `uuid`/`pollToken` back (backed by no persisted row when the caller is over the rate
limit, or a row with `userId: null` otherwise, which can never be approved). The abuse guard's
`isOverCreateLimit` reinforces this: it always computes both the per-IP and per-username counts
via `Promise.all`, never short-circuiting on whichever resolves first, so a caller can't binary-
search which count tripped the limit by observing response timing.

### Hardening limits (`AuthorizationRequestAbuseGuardService`)

Split out of `AuthorizationRequestService` to keep the core state machine focused — not exported
from `AuthModule`, an internal collaborator only. Exact defaults/env vars are catalogued in
`docs/agents/environment-variables.md`:

- **`create` rate limit** — per-IP and per-username request counts within a sliding window; over
  either limit, `create` still returns a normal-shaped response but persists no row and fires no
  event.
- **Concurrent-open cap** — a resolved user's simultaneous `open` requests are capped; hitting the
  cap evicts (expires) the oldest open request rather than rejecting the new `create`.
- **`authorize` cool-off lockout** — consecutive wrong-password `authorize` attempts, tracked per
  request row, trip a timed lockout once a threshold is reached. A locked-out attempt still runs
  the password compare (against a dummy bcrypt digest when the approver row itself is missing), so
  it stays timing-equivalent to a normal attempt.

## Admin authorization

Routes (or whole controllers) requiring an admin account are annotated `@AdminOnly()`
(`core/admin-only.decorator.ts`), enforced by the global `AdminGuard` (`core/admin.guard.ts`),
registered as an `APP_GUARD` right after `JwtGuard`. `AdminGuard` never re-verifies the JWT — it
just reads `isAdmin` off `request.user`, which `JwtGuard` builds from the session's **DB row**
on every request, so a demoted admin gets `403` on their next request, not after the
access-token TTL. Routes
without `@AdminOnly()` metadata are unaffected. An unauthenticated request already gets `401`
from `JwtGuard`; `@AdminOnly()` plus an authenticated non-admin gets `403` from `AdminGuard`.
`@AdminOnly()` and `@Public()` on the same route are contradictory — `@Public()` skips `JwtGuard`,
leaving `request.user` unset, which `AdminGuard` treats as forbidden.

`isAdmin` is exposed on the `user` object returned by `login`/`register`/`refresh`, and on
`/auth/status.json`'s response — see "Routes" above — so the frontend can gate admin-only UI
(e.g. the user-lookup/recovery-link tool, `AdminController`) without decoding the `httpOnly`
access-token cookie itself.

**First admin**: there is no admin-provisioning endpoint or CLI. Promote an account manually,
directly against the database:

```sql
UPDATE auth_users SET is_admin = true WHERE username = '<username>';
```

## `user.registered` event

`AuthService#register` fires `user.registered` (via `EventEmitter2`) with a
`UserRegisteredEvent { userId, username, email }` payload on every successful registration — see
`events/user-registered.event.ts`. No listener consumes it yet; it exists so a future module
(e.g. a welcome-email or onboarding module) can react without `AuthService` knowing it exists,
per the modular pattern's event-driven communication rule.

## `password-recovery.requested` event

`PasswordResetService#recover` fires `password-recovery.requested` (via `EventEmitter2`) with a
`PasswordRecoveryRequestedEvent { userId, token, resetUrl, email }` payload whenever a recovery
is requested for a known email — see `events/password-recovery-requested.event.ts`. It is
consumed in-module by `events/password-recovery-requested.listener.ts`, which renders the
`password-recovery` mail template and sends it through `MailService.sendEmailTemplate` (Mail
module, direct DI — `AuthModule` imports `MailModule`). Delivery is best-effort: the listener
swallows every send error (one `warn` line, `userId` only) and treats
a disabled-mail `{ status: 'skipped' }` as success, so a mail problem never affects the
already-responded `/auth/recover.json` request.

## Testing

The user-approval and session-gate behavior is covered by `auth/tests/session.service.spec.ts`,
`auth/tests/session-status.service.spec.ts`, `auth/tests/user-approval.config.spec.ts`,
`auth/tests/auth.controller.session-gate.e2e-spec.ts`,
`auth/tests/auth.controller.user-status.e2e-spec.ts` and
`auth/tests/admin.controller.review.e2e-spec.ts`. E2e specs replace the real `SESSION_LOOKUP`
with `auth/tests/support/in-memory-session-lookup.ts` (`InMemorySessionLookup`), backed by the
in-memory repositories.

- `auth/tests/auth.service.spec.ts` — unit specs, mocked repositories, port of the old
  `Authenticator_spec.js`/`Registrar_spec.js` coverage plus the JWT/refresh/logout behavior.
- `auth/tests/auth.controller.e2e-spec.ts` — e2e specs via `supertest` against a real
  `INestApplication` with in-memory fake repositories (see `architecture/backend.md`'s Testing
  section): login flow, refresh-token rotation (including replay/expiry rejection), logout, and
  the global `JwtGuard` (public routes, missing/invalid/valid access token) against two
  throwaway controllers defined in the spec itself.
- `auth/tests/admin.service.spec.ts` — unit specs, mocked repositories: `searchUsers`
  with/without a query, `generateRecoveryLink`/`sendRecoveryEmail` user-found/not-found paths,
  and the mail `sent`/`skipped`/throwing outcomes for `sendRecoveryEmail`.
- `auth/tests/support/in-memory-repo.ts` — the single shared in-memory fake TypeORM repository
  (`createInMemoryRepo`/`matchesCondition`), re-exported by
  `auth/tests/auth.controller.e2e-test-support.ts` and
  `auth/tests/authorization-request.controller.e2e-test-support.ts`.
- `auth/tests/admin.controller.e2e-spec.ts` — e2e specs, built via the shared `buildTestApp({
  adminGuard: true, registerDefaultUser: false })` from `auth.controller.e2e-test-support.ts`,
  plus the global `JwtGuard`/`AdminGuard` pair registered as `APP_GUARD`s: unauthenticated (`401`)
  and authenticated-non-admin (`403`) rejection on all three routes, an admin caller's documented
  response shapes, `404` for an unknown user id, and `X-Skip-Cache: true` on every response.
