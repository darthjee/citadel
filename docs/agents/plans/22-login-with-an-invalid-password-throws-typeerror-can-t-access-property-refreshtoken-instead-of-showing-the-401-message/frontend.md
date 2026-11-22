# Frontend Plan: Login with an invalid password throws `TypeError` instead of showing the 401 message

Main plan: [plan.md](plan.md)

## Overview
All code changes live in `frontend/`. `ApiClient` gains a per-call `{ skipAuthRecovery: true }`
option and a reject-on-expiry contract. `AccountsClient` opts out on every `@Public()` route.
Every consumer that relied on the `undefined` resolve is migrated to a single
`isSessionExpired(error)` check. The final step (docs) is owned by the architect.

## Context
`POST /auth/login.json` answers `401 { error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' } }`,
but `ApiClient.sendJson` routes every `401` into `handleUnauthorized`/`sessionExpired()`, which
clears `AuthSession`, re-opens the modal and resolves `undefined`. `AccountsClient.login` then
reads `result.refreshToken` and throws a `TypeError`. With a stored refresh token, a wrong
password also rotates and then clears the token, logging the user out.

`LoginModalController#submitPassword` and `LoginErrorMessages.forLogin` already map an
`ApiError` correctly (unmapped `UNAUTHORIZED` falls back to `error.message`, `USER_DENIED` maps
to "This account has been denied access."). They need no change once `login` rejects properly.

**Reference implementation:** Ward's fix is the same change on the same code base shape. Read it
in the worktree `/Users/darthjee/orca/workspaces/ward/glassfish` (HEAD = `aa398da`):
`git -C /Users/darthjee/orca/workspaces/ward/glassfish show aa398da -- <path>` for a diff,
`git -C /Users/darthjee/orca/workspaces/ward/glassfish show aa398da:<path>` for a file. Do not
read the main checkout `/Users/darthjee/projetos/orca/ward` (it predates the fix). Adapt, do not
copy blindly: citadel's `ApiClient` has no `getJson` and no `403`/`PermissionEvents` branch, and
citadel has no bank, organization or owner-context modules.

## Contract decided for this plan

- `ApiClient.postJson(path, body, options)`, `deleteJson(path, body, options)`,
  `patchJson(path, body, options)`. `options` is optional, `{ skipAuthRecovery?: boolean }`,
  default `false`. (Citadel has no `getJson`; do not add one.)
- `skipAuthRecovery: true`: a `401` goes straight to `throw buildApiError(response, data)`. No
  refresh request, no retry, no `AuthSession` change, no `LoginModalEvents.open`.
- Default routes, failed recovery (no stored refresh token / refresh fails / retried request
  answers `401` again): run `AuthSession.clear()` + `LoginModalEvents.open('password')`, then
  **throw** the `ApiError` built from the **original (first)** `401` response, with
  `error.sessionExpired === true`.
- `ApiError` gets a `sessionExpired` boolean field, default `false`.
- New helper `frontend/assets/js/client/isSessionExpired.js` exporting
  `isSessionExpired(error)` (named + default export), returning `true` only for an `ApiError`
  whose `sessionExpired` is `true`. Consumers use this, **not** `status === 401`, because
  opted-out public-route 401s are real credential errors that must still be shown.
- Rule: a session-expired rejection is never shown as an error by a consumer. The consumer
  resets its pending/loading/confirm state and returns.
- Public routes (must match the backend `@Public()` routes exactly): `register`, `login`,
  `refresh`, `logout` (`DELETE /auth/logoff.json` — `@Public()` in citadel, unlike Ward),
  `status`, `recover`, `resetPassword`, `createAuthorizationRequest`, `pollAuthorizationRequest`.

## Steps

- [01 — ApiClient: opt-out and reject-on-expiry](frontend/01-api-client-opt-out-and-reject.md)
- [02 — AccountsClient: public routes opt out](frontend/02-accounts-client-public-opt-out.md)
- [03 — Consumers: handle session-expired rejection](frontend/03-consumers.md)
- [04 — Login modal end-to-end specs](frontend/04-login-modal-specs.md)
- [05 — Docs (architect)](frontend/05-docs.md)

Steps 01–03 must land together: step 01 alone changes behavior for every consumer and would
show spurious errors next to the login modal.

## CI Checks
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- `LoginModalControllerSpec.js` is at the 300-line limit (`ApiClientSpec.js` is 222). Put new
  cases in sibling spec files instead of growing them.
- `sendJson` complexity must stay under the ESLint limit. Replace its positional `isRetry`
  boolean with an options object (`{ skipAuthRecovery, isRetry, originalError }`) rather than
  adding more positional args.
- Existing specs that encode the old `undefined` contract must be migrated to "rejects with a
  session-expired `ApiError` and the consumer shows nothing", not deleted.
- `logout`'s `finally { AuthSession.clear(); }` is unchanged; with the opt-out a `401` from
  `logoff.json` simply rejects (and is swallowed by `HeaderController`) instead of attempting a
  refresh.
- Run all commands through `docker-compose run --rm citadel_placeholder_fe ...`, never on the host.
