# Plan: User-side approval flow (backend)

Issue: [5-user-side-approval-flow-backend-frontend.md](../../issues/5-user-side-approval-flow-backend-frontend.md)

## Overview

Adds the account status (`pending` / `approved` / `denied`), the opt-in
`CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` flag, the gate's `approved` requirement and the
status-aware `@Public()` auth endpoints (login, register, status, refresh, recover / reset, device
poll), per the [user-approval specs](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/README.md). The status migration and the gate condition
ship in this same PR. Frontend is #12, admin tools #6, docs #7.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)
- [cache](cache.md)

## Shared contracts

- Env var `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`: exactly `true` → on; anything else (unset,
  empty, `TRUE`, `1`, …) → off. Read only by `backend/src/auth/user-approval.config.ts`, once at
  boot. Default (sample) value: `false`. Reaches the backend containers through `env_file`.
- `POST /auth/status.json` response gains one shape:
  `{ "loggedIn": false, "isAdmin": false, "status": "pending" }` (the `status` key only for
  pending). The other answers are unchanged.
- `POST /auth/login.json` gains `403`
  `{ "error": { "code": "USER_DENIED", "message": "This account has been denied access" }, … }`.
- No new route; every changed route is on `AuthController` / `AuthorizationRequestController`,
  both `@CachePolicy(CacheClass.Never)`.
