# Login modal end-to-end specs

Add `LoginModalControllerWrongPasswordSpec.js` next to `LoginModalControllerDeniedSpec.js`
(`LoginModalControllerSpec.js` is at the 300-line limit). Ward reference:
`frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerWrongPasswordSpec.js`
at `aa398da`. These cases use the **real** `AccountsClient` + `ApiClient` with
`stubRefreshFlow` / `fetchSequence` (from `specs/support/fetchSequence.js`) and `fakeWindow`,
so the whole stack is exercised with only `fetch` stubbed:

1. Wrong password, no stored refresh token (`stubRefreshFlow(..., { refreshToken: null })`, login
   answers `401 UNAUTHORIZED 'Invalid username or password'`): `setSubmitError` receives
   `Invalid username or password`, no exception escapes, the modal is not closed,
   `AuthSession.set/clear`, `LoginModalEvents.open/close` and `AuthEvents.emit` are not called,
   and exactly one fetch (`/auth/login.json`) was made.
2. Wrong password with a valid stored refresh token: same message; `AuthSession.set` and
   `AuthSession.clear` are never called; exactly one fetch was made, so `/auth/refresh.json` was
   never requested and the token was not rotated.
3. `403 USER_DENIED` through the real client still shows `This account has been denied access.`

No production change is expected in `LoginModalController` or `LoginErrorMessages`. If a spec
shows otherwise, fix it there.

## Files to Change
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerWrongPasswordSpec.js` — new
