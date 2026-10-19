# `TokenService#revokeUserTokens` and error codes

Following Kerghan, move the "revoke every unrevoked refresh token of a user" query out of the
private `AuthService#revokeTokenFamily` into a public method on `TokenService`, so password
reset, replay detection and the admin deny (step 04) share one implementation:

```ts
async revokeUserTokens(userId: number, reason: RevokedReason): Promise<void> {
  await this.refreshTokenRepository.update(
    { userId, revokedAt: IsNull() },
    { revokedAt: new Date(), revokedReason: reason },
  );
}
```

JSDoc in the style of `revokeToken`: already-revoked rows keep their reason. Kerghan's optional
`keepRefreshToken` parameter is not ported (no caller in Citadel).

- `AuthService`: delete `#revokeTokenFamily`; `resetPassword` calls
  `this.tokenService.revokeUserTokens(userId, RevokedReason.PASSWORD_RESET)` and replay detection
  in `refresh` calls it with `RevokedReason.REPLAY_DETECTED`. Drop the `IsNull` import if unused.
- `auth.service.spec.ts`: add `revokeUserTokens: jest.Mock` to the `tokenService` double; the
  password-reset and replay tests now assert `tokenService.revokeUserTokens` was called with
  `(userId, reason)` instead of asserting `refreshTokenRepository.update`.
- `token.service.spec.ts`: new `describe('revokeUserTokens')` asserting the `update` criteria
  `{ userId, revokedAt: IsNull() }` and patch `{ revokedAt: any Date, revokedReason: reason }`.
- `ErrorCodes`: add `USER_NOT_PENDING` and `CANNOT_DENY_SELF`.
- The in-memory-repo comment naming `AuthService#revokeTokenFamily` as the `IsNull()` user is
  updated to `TokenService#revokeUserTokens`.

Existing e2e (refresh replay, password reset) must stay green unchanged.

## Files to Change

- `backend/src/auth/token.service.ts` — new `revokeUserTokens`.
- `backend/src/auth/auth.service.ts` — use it; remove `#revokeTokenFamily`.
- `backend/src/auth/tests/token.service.spec.ts` — unit tests for `revokeUserTokens`.
- `backend/src/auth/tests/auth.service.spec.ts` — double and assertions updated.
- `backend/src/core/error-codes.ts` — `USER_NOT_PENDING`, `CANNOT_DENY_SELF`.
- `backend/src/auth/tests/support/in-memory-repo.ts` — comment only.
