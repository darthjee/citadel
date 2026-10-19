# Issue: User-side approval flow (backend)

## Description

Part of the user-approval Epic (#1); builds on the session-lookup gate shipped by #4. Implements
the **user side** of the
[user-approval specs](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/README.md),
the account status, the opt-in approval flag, the gate's `approved` requirement and the
status-aware auth endpoints. The frontend (awaiting-approval view, denied-login message) is #12;
the admin review tools (listing filter, approve, deny) are #6.

Source of truth:
[model.md → User status](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/model.md#user-status),
[config.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/config.md),
[gate.md → The gate requires `approved`](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/gate.md#the-gate-requires-approved),
[errors.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/errors.md),
[security.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/security.md),
[api/auth.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/api/auth.md),
[ui/user.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/ui/user.md).

## Problem

Every self-registered account can use the application immediately, and there is no way to keep an
account out short of deleting it. Citadel Placeholder accounts have no status, so the gate from #4
has nothing to check beyond the session itself.

## Expected Behavior

- Accounts carry a status: `pending`, `approved` or `denied`. **Only `approved` users are
  authenticated**, enforced by the gate on every request, whatever the flag.
- `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` (exactly `true` → on, default off) decides only the
  status of a **new self-registration**: off → `approved` (today's behavior), on → `pending`.
- Existing users stay usable: the migration backfills them to `approved`.
- A pending user who logs in or registers gets a real session that the gate blocks; `status.json`
  answers `status: "pending"` and keeps the session, so an approval is picked up on the next check
  without logging in again (the frontend view is #12).
- A denied user looks like an unknown or logged-out one everywhere, except login with the
  **correct** password, which answers `403 USER_DENIED` (`This account has been denied access`).

## Solution

### Backend

Model and config:

- `UserStatus` (`pending`, `approved`, `denied`) in `auth/entities/user.entity.ts`;
  `status varchar(16) NOT NULL` with **no column default**.
- Migration `<timestamp>-auth-add-users-status.ts`: add nullable → `UPDATE auth_users SET status =
  'approved'` (covers the demo seed users) → `NOT NULL`. `down` drops the column. Must ship in the
  same deploy as the gate condition below (same PR).
- `RevokedReason.ADMIN_DENIED = 'admin_denied'` (never triggers replay detection).
- `ErrorCodes.USER_DENIED` (`403`, `This account has been denied access`), message in an exported
  constant next to the throw.
- New `auth/user-approval.config.ts`: `UserApprovalConfig` (`fromConfigService`, `required`,
  `registrationStatus()`), the only reader of the env var, provided by a factory in `AuthModule`.

Gate:

- `SessionService#findActiveSessionUser` adds `user.status = 'approved'`; the in-memory
  `InMemorySessionLookup` test double gets the same rule.

Auth endpoints (per [api/auth.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/api/auth.md)):

- `register.json`: status from `UserApprovalConfig#registrationStatus()`; response unchanged.
- `login.json`: after the password check, `denied` → `403 USER_DENIED` (no session); a wrong
  password stays `401` whatever the status; `pending` gets a normal session.
- `status.json`: pending → `{ loggedIn: false, isAdmin: false, status: "pending" }` (session kept);
  denied with an active token → the anonymous answer, byte-for-byte, and that token revoked with
  `admin_denied`. `status` appears only for pending.
- `refresh.json`: after the existing token checks, pending rotates; denied → token revoked with
  `admin_denied`, plain `401`, no replay detection.
- `recover.json`: denied treated like an unknown email (no token, no event).
  `reset-password.json`: a denied user's valid token → the same `400` as an unknown one, checked
  **before** `bcrypt.hash`, token not consumed; pending can reset and stays pending.
- Device-authorization poll: the winning poll reloads the requester; non-approved → conditional
  `logged → denied`, answers `{ status: 'denied' }`, no session. `create` stays identical for
  every status.
- The `user` payload of the auth endpoints never carries `status`.

### Config and cache

- `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` added to
  [environment-variables.md](https://github.com/darthjee/citadel/blob/main/docs/agents/environment-variables.md)
  (Consumed, optional) and `.env.dev.sample` (`false`). `docker-compose.yml` loads it through
  `env_file`, so no compose change is expected; confirm it reaches the backend containers.
- `AuthController` and `AuthorizationRequestController` are already
  `@CachePolicy(CacheClass.Never)`; confirm `status.json` and the other auth endpoints stay uncached
  (`X-Skip-Cache`). No Navi change expected.

### Tests

Every "Required tests" list tagged #5 in the specs: model.md (status migration, no default, no
`status` in the payload), config.md, gate.md (pending / denied lookup, approval lets the **same**
token pass), errors.md and security.md (byte-for-byte `401` / anonymous comparisons, recovery
non-disclosure, refresh race, poll race, no `bcrypt.hash` for denied) and api/auth.md. The ui/user.md tests are #12.

### Out of scope

- Frontend (awaiting-approval view, `AuthStatus`, denied-login message): #12.
- Admin status filter, approve, deny and the admin UI: #6.
- Auth module docs and `product.md` updates: #7.
- Exercising the `approved` condition against MySQL: #9 (already noted there).

Kerghan reference (backend part): commit [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e)
([darthjee/kerghan#392](https://github.com/darthjee/kerghan/issues/392)).

### Agents

backend implements; infra owns `.env.dev.sample` and the compose check; cache confirms
the endpoints stay uncached; the `security` agent reviews the non-disclosure and race handling
during implementation.

## Acceptance criteria

- Flag off: registration behaves as today. Flag on: new users are pending and blocked by the gate.
- Existing users stay usable after the migration.
- A pending user's same access token passes once approved, without a new login; a denied user
  gets `USER_DENIED` only after a correct password.
- Backend specs mirror the Kerghan ones listed in the specs' "Required tests".
- `yarn coverage` and `yarn lint` pass in the backend (through `docker-compose`).
