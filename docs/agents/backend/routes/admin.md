# Routes — Admin

Admin user-tool routes, served by `AdminController` (`auth/admin.controller.ts`) under the
`/admin` prefix. The controller lives in the Auth module, since it only reads and writes Auth
tables. Every route requires the default `JwtGuard` (no `@Public()`) plus `@AdminOnly()`,
applied once at the controller level: anonymous callers get `401` from the gate, authenticated
non-admins get `403` from `AdminGuard`. The controller is thin; business logic lives in
`AdminService` (`auth/admin.service.ts`).

The review tools (status filter, approve, deny) are **always available**, whatever
`CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` says — see
[User approval](../../modules/auth/user-approval.md).

## Admin user item

Every route returning a user serializes it with `AdminController`'s own serializer:

```json
{ "id": 7, "username": "bob", "email": "bob@example.com", "isAdmin": false,
  "createdAt": "2026-10-17T12:00:00.000Z", "status": "pending" }
```

Never the password digest, tokens or `updatedAt`. `status` appears only here, never in the auth
endpoints' shared `user` payload (`auth/auth-response.ts`).

An `:id` that is not an integer answers `400` (`ParseIntPipe`); an unknown `:id` answers
`404 User not found`.

## Endpoints

### `POST /admin/users/search.json`

| Property | Value |
| --- | --- |
| Request body | `SearchUsersDto` — `{ q?: string, status?: 'pending' \| 'approved' \| 'denied' }` |
| Success response | `{ users: [adminUser], currentUserId }` |
| HTTP status | `200`; `400 VALIDATION_FAILED` on an invalid `status` |

`q` matches `username` or `email` case-insensitively (`ILike`); `status` filters by account
status; both are optional and ANDed. With neither, every account is returned, unpaginated.
`currentUserId` is the caller's own id (`@CurrentUser().sub`), so the admin page can hide deny on
the admin's own row (`status.json` exposes no user id).

### `POST /admin/users/:id/edit.json`

| Property | Value |
| --- | --- |
| Request body | `AdminUpdateUserDto` — `{ username?, email?, newPassword? }` (at least one) |
| Success response | `{ user: adminUser }` |
| HTTP status | `200`; `400` when no field changes; `409 USERNAME_TAKEN` / `EMAIL_TAKEN`; `404` |

Updates the target user's username, email and/or password on the admin's behalf, with no
current-password confirmation. Never changes `isAdmin` or `status`.

### `POST /admin/users/:id/approve.json`

| Property | Value |
| --- | --- |
| Request body | — |
| Success response | `{ user: adminUser }` with `status: 'approved'` |
| HTTP status | `200` |

| Case | Answer |
| --- | --- |
| Unknown id | `404 User not found` |
| User not `pending` | `422 USER_NOT_PENDING` — `Only pending users can be approved`; nothing changed |
| Otherwise | `200`, status `approved` |

A **conditional update** (`WHERE id = ? AND status = 'pending'`), so a concurrent deny is never
overwritten: a late approve gets `422`. Sessions are untouched: the user's existing session
passes the gate on its next request, with no new login.

### `POST /admin/users/:id/deny.json`

| Property | Value |
| --- | --- |
| Request body | — |
| Success response | `{ user: adminUser }` with `status: 'denied'` |
| HTTP status | `200` |

Checks in order:

| Case | Answer |
| --- | --- |
| Unknown id | `404 User not found` |
| Caller's own id | `422 CANNOT_DENY_SELF` — `You cannot deny your own account`; nothing changed |
| Otherwise, from **any** status (including `denied`) | `200`, status `denied` |

The caller's id comes from `@CurrentUser().sub` (passed to `AdminService#denyUser(userId,
callerId)`), never from the body or route params. After setting the status, every **active**
refresh token of the user is revoked with `admin_denied` (already-revoked rows keep their
reason), so the gate logs the user out everywhere on their next request; `admin_denied` never
triggers replay detection. The status update and the bulk revoke are two writes, not one
transaction: once the status is `denied`, the gate rejects every session even if the revoke
fails, and a retried deny revokes what is left. **Admins can deny other admins**; only
self-deny is refused. The row is kept, so username and email stay taken.

### `POST /admin/users/:id/recovery-link.json`

| Property | Value |
| --- | --- |
| Request body | — |
| Success response | `{ resetUrl }` |
| HTTP status | `200`; `404` |

Mints a fresh password-reset token via `PasswordResetService#issueToken`, without invalidating
the user's other outstanding tokens. Redeeming it for a denied user fails like an unknown token
(see [Auth routes](auth.md#post-authreset-passwordjson)).

### `POST /admin/users/:id/send-recovery-email.json`

| Property | Value |
| --- | --- |
| Request body | — |
| Success response | `{ sent }` |
| HTTP status | `200`; `404` |

Mints a token the same way, then sends the `password-recovery` template directly and
synchronously through `MailService.sendEmailTemplate`. `sent: false` covers both a disabled mail
transport and a thrown send error, never a `500`.

## Cache policy

All six routes are `@CachePolicy(CacheClass.Never)` (controller level), so they send
`X-Skip-Cache: true` and `Cache-Control: no-store`. None is warmed by Navi. See
[API Caching](../../architecture/caching.md).

## Source files

| File | Role |
| --- | --- |
| `auth/admin.controller.ts` | Route definitions, admin user serializer |
| `auth/admin.service.ts` | Search, edit, approve, deny, recovery-link/email business logic |
| `auth/dto/search-users.dto.ts` | `SearchUsersDto` validation (`q`, `status`) |
| `auth/dto/admin-update-user.dto.ts` | `AdminUpdateUserDto` validation |
| `auth/token.service.ts` | `revokeUserTokens` used by deny |
| `core/error-codes.ts` | `USER_NOT_PENDING`, `CANNOT_DENY_SELF` |
