# Refresh: check order and atomic rotation

Rework `AuthService#refresh` and `#findActiveRefreshToken` as follows.

Check order:

1. Unknown token → `401 Invalid or expired refresh token`.
2. **Expired** → `401`, with no side effects. This now comes before the revocation check.
3. `revokedReason === 'rotated'` → replay detection: `#revokeTokenFamily(userId, REPLAY_DETECTED)`,
   then `401`.
4. Revoked for any other reason → plain `401`, with no side effects.

Atomic, single-winner rotation, inside `this.refreshTokenRepository.manager.transaction(async (manager) => …)`:

1. Insert the replacement with
   `tokenService.issueTokens(user, { sessionUuid, startedAt } from the presented row, manager)`.
2. Revoke conditionally with `manager.getRepository(RefreshToken).update({ id, revokedAt: IsNull() },
   { revokedAt: now, revokedReason: ROTATED })`.
3. If `affected !== 1`, throw `UnauthorizedException('Invalid or expired refresh token')`. The throw
   rolls the transaction back, so the inserted replacement disappears.

Update the JSDoc so it explains why the insert comes first: no window without an active row.

Test support, so that e2e specs keep working on the in-memory repo:

- `createInMemoryRepo.update` returns `{ affected }`, the number of matched rows. Existing callers
  ignore the return value.
- Add `manager: { transaction: (cb) => cb(fakeManager) }`, where `fakeManager.getRepository()`
  returns the same in-memory repo. It is a pass-through with no real rollback; document that, and
  point to #9 for real-engine checks.
- Remove the replacement row on a thrown callback only if that is simple. Otherwise cover rollback
  in the unit spec.

Unit tests (`auth.service.spec.ts`, with mocks for the manager, transaction and repository):

- the replacement copies the presented row's `sessionUuid` and `startedAt`;
- `affected = 0` → `401`, and the transaction callback rejects, so it rolls back;
- an insert that throws → the conditional revoke is never called, and the error propagates;
- an expired rotated token → `401` with no family revoke;
- a `rotated` token that is not expired → family revoked with `replay_detected`;
- a `logout`-revoked token → `401` with no family revoke.

Update the existing `refresh` e2e specs in `auth.controller.refresh-logout.e2e-spec.ts` so they
check that the new row shares the session and that the old row has `revokedReason = 'rotated'`.

## Files to Change

- `backend/src/auth/auth.service.ts`: `refresh`, `#findActiveRefreshToken`, JSDoc.
- `backend/src/auth/tests/support/in-memory-repo.ts`: `update` returns `{ affected }`; `manager.transaction`.
- `backend/src/auth/tests/auth.service.spec.ts`: rotation, check-order and replay unit tests.
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts`: session copy and `rotated` reason.
