# Auth API

Back to the [feature README](../README.md).

Implemented by #5. All routes are on the existing `AuthController` /
`AuthorizationRequestController` (`/auth` prefix, `@CachePolicy(CacheClass.Never)`), thin,
delegating to the Auth module's services.

Citadel adaptations of Kerghan's flow:

- The refresh token travels in the request **body** (`{ "refreshToken": "…" }`) and the frontend
  stores it in `localStorage`; there is no `refresh_token` cookie. "Keep / clear the session"
  below means "the frontend keeps / drops the stored refresh token" (plus the backend's existing
  `access_token` cookie handling).
- No default user: `status.json` has no automatic login.
- Login has no `keepSignedIn` field.

## Which endpoints read the status

Business endpoints never read the status: the gate makes pending and denied users anonymous to
them ([gate.md](../gate.md)). Only these `@Public()` endpoints look at the real status, because
the gate does not cover them:

| Endpoint | Why |
|---|---|
| `POST /auth/login.json` | `denied` → `403 USER_DENIED`, only after the password is verified |
| `POST /auth/register.json` | Sets the initial status from the flag |
| `POST /auth/status.json` | Reports `pending` so the frontend can show the awaiting-approval view |
| `POST /auth/refresh.json` | Rejects a denied user's token; keeps rotating a pending one |
| `POST /auth/recover.json`, `POST /auth/reset-password.json` | Must not reveal the status; a denied user cannot reset |
| `POST /auth/authorization-requests/:uuid/poll.json` | Never mints a session for a non-approved user |

`DELETE /auth/logoff.json` is unchanged for every status.

## `POST /auth/login.json`

Request (unchanged):

```json
{ "username": "alice", "password": "secret" }
```

Order of checks:

1. Unknown username or wrong password → the existing `401 Invalid username or password`, whatever
   the status.
2. Correct password, user `denied` → **`403 USER_DENIED`**: no session minted, no cookie set, no
   refresh token returned.
3. Correct password, user `pending` → the normal `200` with a session (its access tokens are
   blocked by the gate until approval).
4. Correct password, user `approved` → unchanged.

```json
// 200 (approved or pending — identical)
{
  "user": { "id": 42, "username": "alice", "email": "alice@example.com", "isAdmin": false },
  "refreshToken": "<token>"
}
```

```json
// 403 (denied, correct password)
{
  "error": { "code": "USER_DENIED", "message": "This account has been denied access" },
  "statusCode": 403,
  "timestamp": "<ISO 8601>"
}
```

```ts
// AuthService#login, after the bcrypt check in #validateCredentials
if (user.status === UserStatus.DENIED) {
  throw new ForbiddenException({ code: ErrorCodes.USER_DENIED, message: USER_DENIED_MESSAGE });
}
```

**Why after the password:** the denied status must not be probeable without the password. A
`403` does not trigger the frontend `ApiClient`'s refresh-and-retry (only `401` does).

## `POST /auth/register.json`

Request and response unchanged (`{ username, password, email }` → `200 { user, refreshToken }` +
`access_token` cookie). The new row's `status` comes from
`UserApprovalConfig#registrationStatus()` ([config.md](../config.md)). The response is identical
for every status: a pending user gets a real session that the gate blocks until approval.

Registering with the username or email of a **denied** account gets the existing
`409 USERNAME_TAKEN` / `EMAIL_TAKEN`: denied rows are never deleted. Intended, no special
handling (see the [README](../README.md#lifecycle-edge-cases)).

## `POST /auth/status.json`

Request (unchanged): `{ "refreshToken": "<token>" }`.

| Caller | Response body | Session |
|---|---|---|
| Active session, `approved` | `{ "loggedIn": true, "isAdmin": false }` | kept |
| Active session, `pending` | `{ "loggedIn": false, "isAdmin": false, "status": "pending" }` | **kept** |
| Active session, `denied` (should not happen: deny revokes everything) | `{ "loggedIn": false, "isAdmin": false }` — byte-for-byte the anonymous answer | dropped; the presented token is revoked with `admin_denied` |
| No active session (unknown, revoked or expired token) | `{ "loggedIn": false, "isAdmin": false }` | dropped |

- `status` appears **only** for `pending`.
- The pending answer is the **one** `loggedIn: false` answer that keeps the session, so the user
  can pick up an approval without logging in again. The frontend must **not** drop the stored
  refresh token on it ([ui/user.md](../ui/user.md)).
- Revoking a denied user's still-active token is the only write `status.json` makes. It stays
  passive otherwise: no rotation, no replay detection, so a second tab's check never logs the
  first one out.
- The `access_token` cookie is not touched by `status.json` (unchanged).

```ts
// AuthService#status
const tokenRow = await this.#findActiveTokenRow(refreshToken);
const user = tokenRow ? await this.userRepository.findOneBy({ id: tokenRow.userId }) : null;

if (tokenRow && user?.status === UserStatus.DENIED) {
  await this.tokenService.revokeToken(tokenRow.id, RevokedReason.ADMIN_DENIED);
} else if (tokenRow && user?.status === UserStatus.PENDING) {
  return { loggedIn: false, isAdmin: false, status: UserStatus.PENDING };
} else if (tokenRow && user) {
  return { loggedIn: true, isAdmin: user.isAdmin };
}
return { loggedIn: false, isAdmin: false };
```

## `POST /auth/refresh.json`

Request (unchanged): `{ "refreshToken": "<token>" }`.

The existing token checks run **first**, in the order defined in
[model.md](../model.md#revoked-reasons): unknown / expired → `401`; revoked `rotated` → replay
detection then `401`; revoked for another reason → `401`. Then, for a still-active token:

- **`pending`**: rotates normally (revokes the presented token with `rotated`, copies the session
  to the new one). The session stays alive; the access tokens it mints are blocked by the gate.
- **`denied`**: revokes the presented token with `admin_denied` and answers the plain
  `401 Invalid or expired refresh token`, with **no** replay detection.
- **`approved`**: unchanged.

**Why, when deny already revokes everything:** a rotation or a winning poll racing deny's bulk
revoke can insert a new active row after it; this check stops that session from rotating on
([security.md](../security.md#races)).

## `POST /auth/recover.json` and `POST /auth/reset-password.json`

| Route | Behavior |
|---|---|
| `recover.json` `{ "email": "…" }` | Always `200 { "sent": true }`. `approved` / `pending`: unchanged (token + email). `denied`: treated like an unknown email — no token, no event, no email. Same log lines as an unknown email. Response time is not equalised (see [security.md](../security.md#non-disclosure)). |
| `reset-password.json` `{ "token": "…", "password": "…" }` | Token errors first, unchanged. Valid token of a `denied` user → the same generic `400 Invalid or expired token` as an unknown token; password unchanged, token **not** consumed. Valid token of a `pending` user → reset works and revokes the user's tokens as today (`password_reset`); the user **stays `pending`**. |

In `PasswordResetService#resetPassword`, the denied check runs **right after the token lookup
and before `bcrypt.hash`**, so a denied user's token takes the same fast path as an unknown one
and response time does not reveal a denied account.

The admin recovery tools (`recovery-link.json`, `send-recovery-email.json`) are unchanged: an
admin can still mint a link for any user, but redeeming it for a denied user fails as above.

## `POST /auth/authorization-requests/:uuid/poll.json`

Request (unchanged): `{ "pollToken": "…" }`.

On the winning poll (the one whose conditional `approved → logged` update succeeds), right before
minting the session, reload the requester and re-check:

```ts
// AuthorizationRequestService#issueSessionFor
if (user.status !== UserStatus.APPROVED) {
  await this.authorizationRequestRepository
    .createQueryBuilder()
    .update()
    .set({ status: 'denied', resolvedAt: () => 'CURRENT_TIMESTAMP' })
    .where('uuid = :uuid AND status = :status', { uuid: request.uuid, status: 'logged' })
    .execute();
  return { status: 'denied' };
}
```

Response: `200 { "status": "denied" }` — the same answer as a request the approver denied — with
no `user`, no session and no cookie. The request moves `logged → denied` with a conditional
`UPDATE … WHERE status = 'logged'`.

`POST /auth/authorization-requests.json` (`create`, `@Public()`) stays **identical for every
status**: it still saves the request and emits `authorization-request.created` for a pending or
denied username, so the response and side effects do not reveal the status. The status only
matters at the winning poll.

`authorize.json` needs no check of its own: it is authenticated, so a non-approved approver gets
the gate's `401` first ([gate.md](../gate.md)).

## Reference

- [auth.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/auth.service.ts)
- [password-reset.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/password-reset.service.ts)
- [authorization-request.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/authorization-request.service.ts)
- [authorization-request-transition.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/authorization-request-transition.ts)
- [routes/auth.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/backend/routes/auth.md)
- Kerghan commit [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e)

## Required tests

Mirroring Kerghan's
[auth.controller.login.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/auth.controller.login.e2e-spec.ts),
[auth.controller.register.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/auth.controller.register.e2e-spec.ts),
[auth.controller.recovery.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts),
[auth.controller.refresh-logout.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts),
[auth.controller.auto-login.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/auth.controller.auto-login.e2e-spec.ts) (its `status.json` cases only),
[authorization-request.service.poll.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/authorization-request.service.poll.spec.ts)
and
[authorization-request.controller.poll.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/authorization-request.controller.poll.e2e-spec.ts).

Login:

- Denied user, wrong password → `401` (identical to an unknown user).
- Denied user, correct password → `403 USER_DENIED`, no cookie, no refresh token, no
  `auth_refresh_tokens` row.
- Pending user, correct password → `200` with a session, identical in shape to an approved
  login.

Register:

- Flag off → `approved`; flag on → `pending`; identical response bodies.
- Username / email of a denied user → the existing `409`.

Status:

- Each of the four answers above, exactly; `status` key present only for pending.
- Denied user with an active token → anonymous answer, byte-for-byte, and that token is revoked
  with `admin_denied`.
- A pending user whose refresh token expired gets the anonymous answer; logging in again gives a
  session whose `status.json` answers `pending`.

Refresh:

- Pending user's token rotates (`rotated`, session copied).
- Denied user's active token → `401`, revoked with `admin_denied`, other tokens untouched (no
  replay detection).
- Presenting an `admin_denied` token again → `401`, no replay detection.

Recovery:

- `recover.json` for a denied email: `200 { sent: true }`, no token row, no event emitted.
- `reset-password.json` with a valid token of a denied user: `400 Invalid or expired token`,
  password unchanged, token still unused, and `bcrypt.hash` never called.
- `reset-password.json` with a valid token of a pending user: password changed, user still
  `pending`.

Payload:

- The `user` payload of `login.json`, `register.json`, `refresh.json` and the winning poll has no
  `status` key, for every status.

Device poll:

- Winning poll for a pending or denied requester → `200 { status: 'denied' }`, no session, no
  cookie; the request row is `denied`.
- Winning poll for an approved requester → unchanged.
- A pending approver calling `authorize.json` → the gate's `401`.
- `create` for a pending, denied and approved username → identical response, a saved request
  and the `authorization-request.created` event in all three cases.
