# Backend Plan: Admin review: approve and deny users (backend)

Main plan: [plan.md](plan.md)

## Shared contracts

- Admin user item: `{ id, username, email, isAdmin, createdAt, status }` on every
  `AdminController` route returning a user. `status` is added only to
  `AdminController#serializeUser`, never to `auth-response.ts`.
- `POST /admin/users/search.json`: body `{ q?, status? }`, `status` validated with
  `@IsOptional() @IsIn(Object.values(UserStatus))` (else `400 VALIDATION_FAILED`); response
  `{ users, currentUserId }`.
- `POST /admin/users/:id/approve.json` → `{ user }`; `404 User not found`;
  `422 USER_NOT_PENDING` "Only pending users can be approved".
- `POST /admin/users/:id/deny.json` → `{ user }`; `404 User not found`;
  `422 CANNOT_DENY_SELF` "You cannot deny your own account".
- Controller-level `@AdminOnly()` and `@CachePolicy(CacheClass.Never)` stay as they are.

## Steps

- [01 — `TokenService#revokeUserTokens` and error codes](backend/01-revoke-user-tokens.md)
- [02 — `status` on admin items, search filter and `currentUserId`](backend/02-search-status.md)
- [03 — Approve](backend/03-approve.md)
- [04 — Deny](backend/04-deny.md)

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn coverage` and
  `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI jobs: `backend_tests`,
  `backend_checks`)

## Notes

- Never run `yarn` / `node` on the host; always through `docker-compose`.
- Keep `AdminController` thin: the not-found, self-deny and conditional-update logic lives in
  `AdminService`. The caller id reaches the service from `@CurrentUser().sub`, never from the body
  or the route params.
- `admin.controller.e2e-spec.ts` is already 249 lines; put the new e2e cases in a new
  `backend/src/auth/tests/admin.controller.review.e2e-spec.ts` (same `useTestApp({ adminGuard:
  true, registerDefaultUser: false })` setup and admin login as the existing spec). E2E users
  register with the flag off, so they are `approved`; set `status` on `ctx.userRepo.rows` to get
  pending or denied users.
- The in-memory repo's `update` already resolves `{ affected }` and its `find` already supports
  an array `where` with `ILike`, so the AND-combined search and the conditional approve run in
  e2e without new test support.
- The `security` agent reviews steps 03–04 (self-deny, revocation, races) and `data-access`
  reviews step 02 (new `status` / `currentUserId` fields) during implementation.
- Exercising the conditional update against MySQL is #9.
- Kerghan reference (commit [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e)):
  [admin.controller.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/admin.controller.ts),
  [admin.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/admin.service.ts),
  [search-users.dto.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/dto/search-users.dto.ts),
  [token.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/token.service.ts).
