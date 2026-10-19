# Login, status and refresh

Per [api/auth.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/api/auth.md).

`auth/auth.service.ts`:

- `login`: after `#validateCredentials` (so a wrong password stays `401 Invalid username or
  password` whatever the status), `user.status === DENIED` →
  `throw new ForbiddenException({ code: ErrorCodes.USER_DENIED, message: USER_DENIED_MESSAGE })`
  before `issueTokens` (no session, no cookie). Export `USER_DENIED_MESSAGE =
  'This account has been denied access'` next to the throw. `pending` gets a normal session.
- `status`: after `#findActiveTokenRow` and the user lookup: denied → revoke that one token
  with `ADMIN_DENIED` and fall through to the anonymous answer; pending →
  `{ loggedIn: false, isAdmin: false, status: UserStatus.PENDING }`; approved → unchanged. No
  other write (still passive). Widen the return type with an optional `status`.
- `refresh`: after `#findRefreshableToken` and the user lookup (existing order unchanged):
  denied → revoke the presented token with `ADMIN_DENIED` (only that row, **no** replay
  detection) and throw `UnauthorizedException('Invalid or expired refresh token')`; pending
  rotates normally. An `admin_denied` token presented again hits the existing "revoked for
  another reason → 401" path (no replay detection) — no code change, but test it.
- A small private `#revokeToken(id, reason)` (or a `TokenService` method, matching where
  revocations already live) for the single-row revoke.

Tests (`auth.service.spec.ts` and the e2e specs
`auth.controller.login.e2e-spec.ts`, `auth.controller.refresh-logout.e2e-spec.ts`):

- Login: denied + wrong password → `401` identical to an unknown user; denied + correct password
  → `403 USER_DENIED` with the exact message, no `access_token` cookie, no refresh token, no new
  `auth_refresh_tokens` row; pending + correct password → `200` with a session, same shape as
  approved.
- Status: the four answers exactly; `status` key only for pending; denied with an active token →
  anonymous answer and that token revoked `admin_denied`; a pending user whose token expired
  gets the anonymous answer and, after logging in again, `pending`.
- Refresh: pending rotates (`rotated`, session copied); denied active token → `401`, revoked
  `admin_denied`, the user's other tokens untouched; presenting an `admin_denied` token again →
  `401`, no replay detection; a refresh token minted after a deny (simulated race) → `401` and
  revoked `admin_denied`, its access token gets the gate's `401`.

## Files to Change

- `backend/src/auth/auth.service.ts` — login / status / refresh checks, `USER_DENIED_MESSAGE`.
- `backend/src/auth/token.service.ts` — only if the single-row revoke is placed there.
- `backend/src/auth/auth.controller.ts` — `status` return type / doc comment only (stays thin).
- `backend/src/auth/tests/auth.service.spec.ts` — unit cases.
- `backend/src/auth/tests/auth.controller.login.e2e-spec.ts` — login cases.
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts` — status and refresh cases.
