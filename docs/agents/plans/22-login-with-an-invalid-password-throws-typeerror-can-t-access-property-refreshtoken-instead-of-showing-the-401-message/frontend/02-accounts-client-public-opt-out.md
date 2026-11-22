# AccountsClient: public routes opt out

In `frontend/assets/js/client/AccountsClient.js`, define one module constant
`const PUBLIC = { skipAuthRecovery: true };` and pass it as the options argument on every
`@Public()` route (verified against `backend/src/auth/auth.controller.ts` and
`backend/src/auth/authorization-request.controller.ts`):

- `register` (`POST /auth/register.json`)
- `login` (`POST /auth/login.json`)
- `refresh` (`POST /auth/refresh.json`)
- `logout` (`DELETE /auth/logoff.json`) — public in citadel, unlike Ward; keep its `finally`
  `AuthSession.clear()`
- `status` (`POST /auth/status.json`)
- `recover` (`POST /auth/recover.json`)
- `resetPassword` (`POST /auth/reset-password.json`)
- `createAuthorizationRequest` (`POST /auth/authorization-requests.json`)
- `pollAuthorizationRequest` (`POST /auth/authorization-requests/:uuid/poll.json`)

Authenticated methods (`listAuthorizationRequests`, `authorizeAuthorizationRequest`,
`denyAuthorizationRequest`, `updateAccount`) and all of `AdminClient` keep the default. Update
JSDoc so no method claims a possible `undefined` resolve.

`utils/polling/AuthorizationRequestPoller.js`: `dispatchPollResult` drops its falsy-result
defence (`(result && result.status) || 'open'` → `result.status || 'open'`) and the
"falsy / `undefined` resolve" JSDoc wording. A 401 from poll now rejects and goes through the
existing error branch, which reschedules.

Specs:
- `AccountsClientSpec.js`: each public method is called with `PUBLIC` (`{ skipAuthRecovery: true }`)
  and each authenticated one without it. For `login`/`register`/`refresh`, add cases where
  `postJson` rejects with `ApiError(401, 'Invalid username or password', 'UNAUTHORIZED')`: the
  promise rejects with that same error and `AuthSession.set`/`clear` are never called. If the
  file would exceed 300 lines, put the new cases in a sibling `AccountsClientPublicRoutesSpec.js`
  (Ward's name).
- `AccountsClientAuthorizationRequestsSpec.js`: create/poll pass the opt-out, the others don't.
- `AuthorizationRequestPollerSpec.js`: replace the "`undefined` resolve" case with a rejected 401
  that reschedules.

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — `PUBLIC` opt-out on public methods, JSDoc
- `frontend/assets/js/utils/polling/AuthorizationRequestPoller.js` — guard and JSDoc
- `frontend/specs/assets/js/client/AccountsClientSpec.js` (and/or new `AccountsClientPublicRoutesSpec.js`)
- `frontend/specs/assets/js/client/AccountsClientAuthorizationRequestsSpec.js`
- `frontend/specs/assets/js/utils/polling/AuthorizationRequestPollerSpec.js`
