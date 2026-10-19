# Deny

`POST /admin/users/:id/deny.json` (no body):

- `AdminController#deny(@Param('id', ParseIntPipe) id, @CurrentUser() caller)` →
  `{ user: serializeUser(await adminService.denyUser(id, caller.sub)) }`.
- `AdminService#denyUser(userId, callerId)`, checks in order:
  1. `#findUserOrThrow` → `404 User not found`;
  2. `user.id === callerId` → `UnprocessableEntityException({ code: ErrorCodes.CANNOT_DENY_SELF,
     message: CANNOT_DENY_SELF_MESSAGE })` (`'You cannot deny your own account'`), nothing
     changed;
  3. from any status (including `denied`, and admins):
     `userRepository.update({ id: user.id }, { status: UserStatus.DENIED })`, then
     `tokenService.revokeUserTokens(user.id, RevokedReason.ADMIN_DENIED)`; re-read and return the
     row.
- Inject `TokenService` into `AdminService` (same Auth module, already a provider); update the
  constructor JSDoc and the class JSDoc (now also approves / denies).
- Two writes, no transaction (per the spec): once `denied`, the gate rejects every session even if
  the revoke fails, and a retried deny revokes the rest. Document this in the method JSDoc.

## Tests

- `admin.service.spec.ts`: unknown id → `404`, nothing written; own id → `422 CANNOT_DENY_SELF`,
  no update, no revoke; pending / approved / denied / admin target → status update then
  `revokeUserTokens(id, 'admin_denied')`, in that order; revoke rejecting → `denyUser` rejects
  after the status update.
- `admin.controller.review.e2e-spec.ts`: pending and approved → `200 status: 'denied'`, every
  unrevoked token of the user revoked with `admin_denied`, an already-revoked token keeps its
  reason; already denied → `200`, a still-active token revoked; own id → `422 CANNOT_DENY_SELF`,
  nothing changed; another admin → `200`; unknown id → `404`; the denied user's access token gets
  the gate's `401 Invalid or expired access token` on the next request; with the token revoke
  failing (spy `TokenService#revokeUserTokens` to reject) the call errors but the user's access
  token still gets `401`; a later `refresh.json` with a revoked token answers a plain `401`
  without replay detection (other rows untouched); non-admin `403`, anonymous `401`.

## Files to Change

- `backend/src/auth/admin.controller.ts` — `deny` route.
- `backend/src/auth/admin.service.ts` — `denyUser`, `TokenService` injection, message constant.
- `backend/src/auth/tests/admin.service.spec.ts` — deny unit tests (`TokenService` double).
- `backend/src/auth/tests/admin.controller.review.e2e-spec.ts` — deny e2e.
