# Logout ends the session; reasons on bulk revokes

`AuthService#logout(refreshToken)`:

- Look up the row by hash, whatever its state (revoked or expired).
- If it is unknown, do nothing. Keep today's response.
- Otherwise revoke every **active** row of that `sessionUuid`:
  `update({ sessionUuid, revokedAt: IsNull() }, { revokedAt: now, revokedReason: LOGOUT })`.
- A stale (already rotated) token therefore still ends its session. Other sessions of the same user
  are untouched.

`#revokeTokenFamily(userId, reason: RevokedReason)`:

- It takes the reason and keeps the `revokedAt: IsNull()` condition, so already-revoked rows keep
  their original reason.
- Callers: `resetPassword` passes `PASSWORD_RESET`; replay detection (step 04) passes
  `REPLAY_DETECTED`.

Tests:

- **Unit (`auth.service.spec.ts`):**
  - logout with an active token revokes the session's active rows with `logout`;
  - logout with a rotated token revokes the session's current active row;
  - logout with an unknown token does nothing;
  - `resetPassword` writes `password_reset` to active rows only.
- **E2e (`auth.controller.refresh-logout.e2e-spec.ts`, `auth.controller.recovery.e2e-spec.ts`):**
  - after login → refresh → logout with the **old** token, the session has no active row and a
    second login session of the same user stays active;
  - after reset, active rows carry `password_reset` and an earlier `rotated` row keeps `rotated`;
  - replaying a `logout` token answers `401` and leaves other sessions active.

## Files to Change

- `backend/src/auth/auth.service.ts`: `logout`, `#revokeTokenFamily(userId, reason)`, `resetPassword`.
- `backend/src/auth/tests/auth.service.spec.ts`: logout and bulk-revoke unit tests.
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts`: session-wide logout, replay of a logout token.
- `backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts`: `password_reset` reason, preserved earlier reasons.
