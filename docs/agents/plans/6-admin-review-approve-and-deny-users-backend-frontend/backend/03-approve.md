# Approve

`POST /admin/users/:id/approve.json` (no body):

- `AdminController#approve(@Param('id', ParseIntPipe) id)` → `{ user: serializeUser(await
  adminService.approveUser(id)) }`. JSDoc in the style of the other routes.
- `AdminService#approveUser(userId)`: `#findUserOrThrow` (`404 User not found`), then the
  conditional update, then re-read and return the row:

```ts
const { affected } = await this.userRepository.update(
  { id: user.id, status: UserStatus.PENDING },
  { status: UserStatus.APPROVED },
);
if (!affected) {
  throw new UnprocessableEntityException({ code: ErrorCodes.USER_NOT_PENDING, message: USER_NOT_PENDING_MESSAGE });
}
```

  `USER_NOT_PENDING_MESSAGE = 'Only pending users can be approved'` as a module constant (like
  `USER_DENIED_MESSAGE`). Sessions are not touched.

## Tests

- `admin.service.spec.ts`: unknown id → `NotFoundException`, no update; pending → update called
  with `{ id, status: 'pending' }` / `{ status: 'approved' }`, returns the re-read row;
  `affected: 0` (approved, denied, or a concurrent deny) → `422` with `USER_NOT_PENDING`.
- `admin.controller.review.e2e-spec.ts`: pending → `200`, `status: 'approved'`, and that user's
  existing access token (logged in while pending, e.g. via a session row created before the
  status change) now passes the gate; approved and denied → `422 USER_NOT_PENDING`, status
  unchanged; unknown id → `404`; a user set to `denied` between lookup and update (spy the repo
  `update` to flip the row first, or set it `denied` before the call) ends `422` and stays
  `denied`; non-admin `403`, anonymous `401`.

## Files to Change

- `backend/src/auth/admin.controller.ts` — `approve` route.
- `backend/src/auth/admin.service.ts` — `approveUser`, message constant.
- `backend/src/auth/tests/admin.service.spec.ts` — approve unit tests.
- `backend/src/auth/tests/admin.controller.review.e2e-spec.ts` — approve e2e.
