# Admin review API

Back to the [feature README](../README.md).

Implemented by #6.

All routes are on the existing `AdminController` (`backend/src/auth/admin.controller.ts`,
`/admin` prefix): default `JwtGuard` + `@AdminOnly()` + `@CachePolicy(CacheClass.Never)` at
controller level, thin controller delegating to `AdminService`. **Always available**, whatever the
flag says ([config.md](../config.md)).

## Admin user item

Every admin route returning a user (including the existing `edit.json`) serializes it as:

```json
{ "id": 7, "username": "bob", "email": "bob@example.com", "isAdmin": false,
  "createdAt": "2026-10-17T12:00:00.000Z", "status": "pending" }
```

`status` is the only new field. Never the password digest, tokens, sessions or `updatedAt`.

## `POST /admin/users/search.json`

Request (both optional, combined with AND; `q` matches username / email case-insensitively, as
today):

```json
{ "q": "bob", "status": "pending" }
```

- `status` must be one of `pending`, `approved`, `denied`:
  `@IsOptional() @IsIn(Object.values(UserStatus))` on `SearchUsersDto`. Anything else →
  `400 VALIDATION_FAILED`. Absent → every status.
- Unpaginated (unchanged).

Response:

```json
{
  "users": [
    { "id": 7, "username": "bob", "email": "bob@example.com", "isAdmin": false,
      "createdAt": "2026-10-17T12:00:00.000Z", "status": "pending" }
  ],
  "currentUserId": 1
}
```

`currentUserId` is the caller's own id (`@CurrentUser().sub`), so the page can hide deny on the
admin's own row: `status.json` exposes no user id.

## `POST /admin/users/:id/approve.json`

No body. `200 { "user": { …, "status": "approved" } }`.

| Case | Answer |
|---|---|
| Unknown id | `404 User not found` |
| User not `pending` | `422 USER_NOT_PENDING` — `Only pending users can be approved`; nothing changed |
| Otherwise | `200`, status `approved` |

Implemented as a **conditional update**, so a concurrent deny can never be overwritten:

```ts
const { affected } = await this.userRepository.update(
  { id: user.id, status: UserStatus.PENDING },
  { status: UserStatus.APPROVED },
);
if (!affected) {
  throw new UnprocessableEntityException({ code: ErrorCodes.USER_NOT_PENDING, message: USER_NOT_PENDING_MESSAGE });
}
```

Sessions are untouched: the pending user's existing session passes the gate on its next request.

## `POST /admin/users/:id/deny.json`

No body. `200 { "user": { …, "status": "denied" } }`. Checks in order:

| Case | Answer |
|---|---|
| Unknown id | `404 User not found` |
| Caller's own id | `422 CANNOT_DENY_SELF` — `You cannot deny your own account` |
| Otherwise, from **any** status (including `denied`) | `200`, status `denied` |

(Kerghan's `409 DEFAULT_USER_MANAGED` check is skipped: Citadel has no default user.)

```ts
await this.userRepository.update({ id: user.id }, { status: UserStatus.DENIED });
await this.tokenService.revokeUserTokens(user.id, RevokedReason.ADMIN_DENIED);
```

- Every **active** refresh token of the user is revoked with `admin_denied`, even if the user was
  already denied. Already-revoked rows keep their reason (replay evidence kept).
- `admin_denied` is not `rotated`, so a later refresh of those tokens never triggers replay
  detection.
- With the gate, the user is logged out everywhere on their next request.
- **Admins can deny admins.** Only oneself is protected. Accepted risk: through the API one admin
  can deny every other admin ([security.md](../security.md#accepted-risks-and-costs)).
- The row is kept: username and email stay taken.

## Admin edge cases

- **Self-deny is refused** (`422 CANNOT_DENY_SELF`), so an admin cannot lock themselves out.
- **An admin denied while on the admin page**: their next admin call answers the gate's `401`
  (the frontend's refresh-and-retry then fails too, ending in the logged-out state).
- **An admin demoted while on the admin page**: their next admin call answers `403` from
  `AdminGuard` (`isAdmin` is read fresh, [gate.md](../gate.md#isadmin-read-fresh-from-the-db)).
- **Two admins act on the same user at once**: approve vs deny is resolved by the conditional
  update ([security.md](../security.md#races)); the loser's error message is shown by the page
  ([ui/admin.md](../ui/admin.md)).

## Cache

All three routes are `CacheClass.Never` (controller level) and none is added to Navi's warm-up;
`cache` confirms this during #6.

## Reference

- [admin.controller.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/admin.controller.ts)
- [admin.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/admin.service.ts)
- [search-users.dto.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/dto/search-users.dto.ts)
- [auth.md → Admin tool routes](https://github.com/darthjee/kerghan/blob/main/docs/agents/modules/auth.md#admin-tool-routes-admincontroller-admin-prefix)
- Kerghan commit [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e)

## Required tests

Mirroring Kerghan's
[admin.service.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/admin.service.spec.ts)
and
[admin.controller.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/admin.controller.e2e-spec.ts).

Search:

- Each `status` value filters; combined with `q` it is an AND; absent returns every status.
- An invalid `status` → `400 VALIDATION_FAILED`.
- Response includes `currentUserId` equal to the caller's id, and `status` on each item.
- `edit.json` items include `status`.

Approve:

- Pending → `200`, status `approved`; the user's existing access token then passes the gate.
- Approved or denied → `422 USER_NOT_PENDING`, status unchanged.
- Unknown id → `404`.
- Conditional update: when the row is no longer `pending` at update time (simulated concurrent
  deny), answers `422` and leaves it `denied`.

Deny:

- Pending and approved → `200`, status `denied`, every active token revoked with
  `admin_denied`, already-revoked tokens keep their reason.
- Already denied → `200`, any active token still revoked.
- Own id → `422 CANNOT_DENY_SELF`, nothing changed.
- Another admin → `200`.
- Unknown id → `404`.
- A denied user's access token gets the gate's `401` on the next request.

Access:

- Non-admin → `403` on all three routes; anonymous → `401`.
