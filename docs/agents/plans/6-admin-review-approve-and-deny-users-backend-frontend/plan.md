# Plan: Admin review: approve and deny users (backend)

Issue: [6-admin-review-approve-and-deny-users-backend-frontend.md](../../issues/6-admin-review-approve-and-deny-users-backend-frontend.md)

## Overview

Adds the admin review API of the
[user-approval specs](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/api/admin.md):
`status` on every admin user item, a `status` filter and `currentUserId` on search, and the new
`approve.json` / `deny.json` routes on the existing `AdminController`. Following Kerghan, the
"revoke all of a user's refresh tokens" query moves into a public
`TokenService#revokeUserTokens(userId, reason)`. Builds on #5 (merged). The admin page is #14,
docs #7.

## Agents involved

- [backend](backend.md)
- [cache](cache.md)

## Shared contracts

- Admin user item (every `AdminController` route returning a user, including `edit.json`):
  `{ id, username, email, isAdmin, createdAt, status }`, `status` one of
  `pending` / `approved` / `denied`. The shared `auth-response.ts` serializer is unchanged.
- `POST /admin/users/search.json` body `{ q?, status? }` → `{ users: [item], currentUserId }`;
  invalid `status` → `400 VALIDATION_FAILED`.
- `POST /admin/users/:id/approve.json` (no body) → `200 { user }`; `404 User not found`;
  `422 { code: USER_NOT_PENDING, message: "Only pending users can be approved" }`.
- `POST /admin/users/:id/deny.json` (no body) → `200 { user }`; `404 User not found`;
  `422 { code: CANNOT_DENY_SELF, message: "You cannot deny your own account" }`.
- All on `AdminController`: `@AdminOnly()` and `@CachePolicy(CacheClass.Never)` at controller
  level; no Navi resource.
