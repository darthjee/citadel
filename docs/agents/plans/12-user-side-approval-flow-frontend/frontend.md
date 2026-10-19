# Frontend Plan: User-side approval flow (frontend)

Main plan: [plan.md](plan.md)

## Overview
Implement [ui/user.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/ui/user.md)
following Kerghan commit [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e). All paths
are under `frontend/assets/js/`; specs mirror them under `frontend/specs/assets/js/`.

## Context
- Backend (#5, merged): `POST /auth/status.json` answers `{ loggedIn, isAdmin }`, plus
  `status: 'pending'` for a pending user only (`loggedIn: false`). A denied user's login with the
  correct password answers `403` with `code: 'USER_DENIED'` (`ApiError#code`).
- `HeaderController#checkStatus` reads only `{ loggedIn, isAdmin }` and clears `AuthSession` on any
  `loggedIn: false`, which would drop a pending user's session.
- `LoginModalController#handleSuccess` (password, register and approved-device paths) and
  `RegisterController#handleSubmit` emit `AuthEvents.emit(true, result.user.isAdmin)` from the
  response.

## Steps

- [01 — Pending on the auth bus and AuthStatus](frontend/01-auth-status.md)
- [02 — Re-check status after login and register](frontend/02-login-register-recheck.md)
- [03 — Denied login message](frontend/03-denied-login-message.md)
- [04 — Awaiting-approval view and Header wiring](frontend/04-awaiting-approval-view.md)

## CI Checks
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn` on the host; always through `docker-compose`.
- **No timer polling** anywhere: `status.json` is never cached and hits the DB.
- Keep the Kerghan initial state: `loggedIn` from `AuthSession.isLoggedIn()`, `pending` from
  `false`. A brief logged-in render before the mount-time check resolves is accepted.
- Out of scope: admin UI (#14), docs and the spec's "Implemented by" lines (#7), backend.
