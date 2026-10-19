# Issue: Admin review: approve and deny users (backend)

## Description

Part of the user-approval Epic (#1); builds on the user-side approval flow shipped by #5
(`UserStatus`, `RevokedReason.ADMIN_DENIED`, status-aware gate). Implements the admin review
specified in
[`api/admin.md`](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/api/admin.md)
. **Backend only**: the admin page is
split into #14.
Always available, whatever `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` says.

## Problem

With approval required, new accounts stay `pending` and nothing can move them: the admin API
cannot see a user's status, filter by it, approve a pending user or deny (and log out) an
account.

## Expected Behavior

- Every admin user item (search and `edit.json`) carries `status`.
- An admin can filter the users list by status, approve a `pending` user and deny any user other
  than themselves; a denied user is logged out everywhere on their next request.
- Concurrent approve vs deny never overwrites a deny.
- The existing admin page keeps working unchanged (it ignores `status` and `currentUserId`) until
  the frontend sub-issue ships.

## Solution

### Backend

`AdminController` stays thin (`@AdminOnly()`, `CacheClass.Never` at controller level); logic in
`AdminService`.

- `#serializeUser` (admin only, not the shared `auth-response.ts` serializer) gains `status`;
  JSDoc return shapes of `search` and `edit` updated.
- `SearchUsersDto`: optional `status` with `@IsIn(Object.values(UserStatus))`, else
  `400 VALIDATION_FAILED`. `AdminService#searchUsers(q, status)` ANDs `status` with each `q`
  branch. Response gains `currentUserId` (`@CurrentUser().sub`).
- `POST /admin/users/:id/approve.json` → `AdminService#approveUser(id)`: `404` for an unknown
  id, then a conditional `update({ id, status: PENDING }, { status: APPROVED })`; `affected === 0`
  → `422 USER_NOT_PENDING` ("Only pending users can be approved"). Sessions untouched.
  Returns `{ user }`.
- `POST /admin/users/:id/deny.json` → `AdminService#denyUser(id, callerId)`: `404`, then own id →
  `422 CANNOT_DENY_SELF` ("You cannot deny your own account"), then from any status set
  `denied` and revoke every unrevoked refresh token with `admin_denied`. Admins can deny admins.
  Returns `{ user }`.
- New `ErrorCodes.USER_NOT_PENDING` and `ErrorCodes.CANNOT_DENY_SELF`.
- Following Kerghan, the bulk revoke moves from the private `AuthService#revokeTokenFamily` to a
  public `TokenService#revokeUserTokens(userId, reason)` (`update({ userId, revokedAt: IsNull() },
  …)`), called by `AuthService` for password reset and replay detection and by
  `AdminService#denyUser`. Already-revoked rows keep their reason. Kerghan's optional
  `keepRefreshToken` parameter is not ported (no caller in Citadel).

### Cache

No new Navi resources. `cache` confirms the three routes stay `CacheClass.Never` (controller
level).

### Tests

Everything under *Required tests* in `api/admin.md`, including: status filter alone and ANDed with
`q`, invalid `status` → `400`, `currentUserId`; approve `404` / `422` / simulated concurrent deny
leaving `denied`; deny `404` / self `422` / admin-denies-admin / already denied / revoke reasons,
denied user's access token gets the gate's `401`, bulk revoke failing after the status update
still blocks the token; non-admin `403` and anonymous `401` on all three routes.

### Out of scope

- Admin users page (`AdminClient`, filter, status column, approve / deny buttons): #14.
- Auth module docs: #7.
- MySQL integration of the conditional update: #9.

Kerghan reference: commit [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e)
(darthjee/kerghan#393).

### Agents

backend, cache (read-only check); security and data-access review.

## Acceptance criteria

- e2e covers the 404 / 422 cases, concurrent approve vs deny, and a denied user logged out on the
  next request.
- `TokenService#revokeUserTokens` unit-tested; password reset and replay detection specs still
  pass through it.
- `yarn coverage` and `yarn lint` pass in backend (through `docker-compose`).
