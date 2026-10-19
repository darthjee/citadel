# Backend Plan: User-side approval flow (backend)

Main plan: [plan.md](plan.md)

## Shared contracts

- Read `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` **only** in `UserApprovalConfig`
  (`=== 'true'`), through `ConfigService`, once at boot. Infra adds it to `.env.dev.sample` and
  `environment-variables.md`.
- `status.json` pending answer: `{ loggedIn: false, isAdmin: false, status: 'pending' }`; every
  other answer unchanged and without a `status` key.
- `login.json` denied + correct password: `403`, code `USER_DENIED`, message
  `This account has been denied access`.
- Routes and their `@CachePolicy(CacheClass.Never)` stay as they are (the cache agent verifies).

## Steps

- [01 — Status model, migration, revoked reason and error code](backend/01-status-model.md)
- [02 — UserApprovalConfig and registration status](backend/02-approval-config.md)
- [03 — Gate requires `approved`](backend/03-gate-approved.md)
- [04 — Login, status and refresh](backend/04-login-status-refresh.md)
- [05 — Recover and reset password](backend/05-recovery.md)
- [06 — Device-authorization poll](backend/06-device-poll.md)
- [07 — Non-disclosure tests](backend/07-non-disclosure-tests.md)

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn coverage` and
  `docker-compose run --rm citadel_placeholder_tests yarn lint`

## Notes

- Never run `yarn` / `node` on the host; always through `docker-compose`.
- Keep controllers thin: every status check lives in `AuthService`, `PasswordResetService`,
  `AuthorizationRequestService` or `SessionService`.
- The `security` agent reviews steps 03–07 during implementation (non-disclosure, races).
- E2E users are created through `register.json` with the flag off, so they are `approved`
  without touching existing fixtures. Unit fixtures that build a `User` by hand and go through a
  status check need `status: 'approved'`.
- Exercising the real `approved` join against MySQL is #9.
- Kerghan reference (commit [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e)):
  [auth.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/auth.service.ts),
  [password-reset.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/password-reset.service.ts),
  [authorization-request.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/authorization-request.service.ts),
  [user-approval.config.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/user-approval.config.ts),
  [20261017120020-auth-add-users-status.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261017120020-auth-add-users-status.ts).
