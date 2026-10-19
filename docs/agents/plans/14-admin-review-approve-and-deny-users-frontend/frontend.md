# Frontend Plan: Admin review: approve and deny users (frontend)

Main plan: [plan.md](plan.md)

## Overview
Implement [ui/admin.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/ui/admin.md)
following Kerghan commit [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e). Paths are
under `frontend/assets/js/`; specs mirror them under `frontend/specs/assets/js/`.

## Context
API from #6, which must be merged first:
- `POST /admin/users/search.json` takes `{ q?, status? }`, with `status` in
  `pending | approved | denied`. It answers `{ users, currentUserId }`, and each user item now
  carries `status`.
- `POST /admin/users/:id/approve.json` with `{}` answers `{ user }`, or `422 USER_NOT_PENDING`, or
  `404`.
- `POST /admin/users/:id/deny.json` with `{}` answers `{ user }`, or `422 CANNOT_DENY_SELF`, or
  `404`. A denied user's sessions are revoked server-side.

Current page:
- `AdminUsers.jsx` holds `query`, `users`, `rowResults` and `searchError`.
- `AdminUsersController` handles search plus the `generateRecoveryLink` / `sendRecoveryEmail` row
  actions. Row errors go to `rowResults[userId] = { error }` (`#handleRowError`), and any `403`
  redirects home (`redirectIfForbidden`).
- `AdminUsersHelper.jsx` renders the form, the table and the row results.

## Steps

- [01 — AdminClient: status filter, approve, deny](frontend/01-admin-client.md)
- [02 — Controller: filter, currentUserId, approve and deny](frontend/02-controller.md)
- [03 — Page, helper and approve / deny buttons](frontend/03-page-and-buttons.md)

## CI Checks
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Never run `yarn` on the host; always through `docker-compose`.
- Keep every file under the 300-line / complexity-10 lint limits. `AdminUsersHelper.jsx` is already
  178 lines, hence the separate button components.
- A demoted admin's `403` keeps the existing behaviour (`redirectIfForbidden` → home); a denied
  admin's `401` ends in the logged-out state through `ApiClient`. No new handling.
- Not gated by `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`.
