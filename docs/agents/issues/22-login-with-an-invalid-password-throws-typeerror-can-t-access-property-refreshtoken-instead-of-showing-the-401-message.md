# Issue: Login with an invalid password throws `TypeError: can't access property "refreshToken"` instead of showing the 401 message

## Description

`POST /auth/login.json` answers correctly with `401` and the standard error body (`{ error: { code: "UNAUTHORIZED", message: "Invalid username or password" }, statusCode: 401, ... }`), but the login modal never renders that message. Instead the console shows `TypeError: can't access property "refreshToken", result is undefined` and the modal displays that raw JavaScript message.

The backend matches its documented contract (`docs/agents/backend/routes/auth.md`; `@CachePolicy(CacheClass.Never)`, so the Tent cache is not involved). The defect is entirely in the frontend HTTP layer (`frontend/assets/js/client/ApiClient.js`).

Reproduction (deterministic, with or without a stored refresh token): open the login modal in password mode, enter a valid username with a wrong password, submit.

The same bug was found and fixed in Ward, an application generated from this template: [darthjee/ward#158](https://github.com/darthjee/ward/issues/158), fix commit [`aa398da`](https://github.com/darthjee/ward/commit/aa398da35dfc7f7b14f94882c120b3259c5152b1). Citadel's `ApiClient` has the identical code, so the fix is ported here, adapted to citadel's routes and consumers.

## Problem

`ApiClient` treats **every** `401` as an expired access token, including `401`s from `@Public()` routes, where a 401 means *invalid credentials/token*:

1. `sendJson` sends every `401` to `handleUnauthorized` (or straight to `sessionExpired()` on a retry) before `buildApiError` runs, so the `ApiError` carrying `UNAUTHORIZED` / `Invalid username or password` is never built.
2. `handleUnauthorized` ends in `sessionExpired()` on both failure paths:
   - no stored refresh token → `sessionExpired()` immediately;
   - stored refresh token → the refresh succeeds and rotates the token, the login is retried, fails with `401` again, and the retry branch calls `sessionExpired()`.
3. `sessionExpired()` clears `AuthSession`, re-opens the login modal (`LoginModalEvents.open('password')`), and **resolves `undefined`**.
4. `AccountsClient.login` then dereferences `result.refreshToken` → `TypeError`.
5. `LoginModalController#submitPassword` catches it, but `LoginErrorMessages.forLogin` has no `code` to map, so it falls back to the engine's `error.message`.

Side effects beyond the crash:

- **A mistyped password logs the user out.** With a valid stored refresh token, the token is rotated and then `AuthSession.clear()` wipes it.
- **The same crash affects sibling methods:** `register`, `refresh` (`AuthSession.set(result.refreshToken)`) and `pollAuthorizationRequest` (`result.status`).
- **Every other `ApiClient` consumer** resolves `undefined` after a failed session recovery. Any consumer that reads the resolved value can crash the same way.

The docs describe the current behavior (`docs/agents/architecture/frontend.md`: "`client/ApiClient.js` reacts to a `401` transparently rather than surfacing it to callers"). That is right for authenticated routes and wrong for the public auth routes, whose purpose is to establish a session. A carve-out already exists for `403 USER_DENIED` on login, but there is none for `401`.

## Expected Behavior

- A wrong password keeps the modal open and shows the backend's message: `Invalid username or password`.
- No JavaScript exception is thrown.
- No session state changes: the stored refresh token is not rotated or cleared, `LoginModalEvents.open` is not fired, and no request is made to the refresh endpoint.
- `403 USER_DENIED` on login still shows `This account has been denied access.`
- On authenticated routes, a `401` still triggers one refresh-and-retry. When recovery fails, the session still ends (`AuthSession.clear()` + login modal opened), but the awaiting caller now gets a **rejected promise with an `ApiError` marked `sessionExpired: true`** instead of a resolved `undefined`.
- Callers show no error message next to the re-opened login modal.

## Solution

Two complementary changes in `frontend/assets/js/client/`, plus a sweep of the consumers.

### A. Public routes opt out of 401 recovery

`ApiClient`'s public methods (`getJson`, `postJson`, `deleteJson`, `patchJson`) take a trailing options argument `{ skipAuthRecovery }` and forward it to `sendJson`. A `401` with the opt-out falls through to the normal `buildApiError` path and is thrown as a plain `ApiError`: no refresh, no retry, no session change.

```js
async function sendJson(method, path, body, { skipAuthRecovery = false, isRetry = false, originalError } = {}) {
  const { response, data } = await request(method, path, body);

  if (response.ok) {
    return data;
  }

  if (response.status === 401 && !skipAuthRecovery) {
    const error = originalError ?? buildApiError(response, data);

    return isRetry
      ? sessionExpired(error)
      : handleUnauthorized(method, path, body, error);
  }

  if (response.status === 403) { /* unchanged: PermissionEvents.emitForbidden() */ }

  throw buildApiError(response, data); // opted-out 401s end up here
}
```

`AccountsClient` defines one shared constant, `const PUBLIC = { skipAuthRecovery: true };`, passed by every method that hits a backend `@Public()` route:

| Method | Route |
| --- | --- |
| `register` | `POST /auth/register.json` |
| `login` | `POST /auth/login.json` |
| `refresh` | `POST /auth/refresh.json` |
| `logout` | `DELETE /auth/logoff.json` |
| `status` | `POST /auth/status.json` |
| `recover` | `POST /auth/recover.json` |
| `resetPassword` | `POST /auth/reset-password.json` |
| `createAuthorizationRequest` | `POST /auth/authorization-requests.json` |
| `pollAuthorizationRequest` | `POST /auth/authorization-requests/:uuid/poll.json` |

Rule: **a public route never attempts session recovery.** The list must match the backend's `@Public()` routes exactly (`backend/src/auth/auth.controller.ts`, `backend/src/auth/authorization-request.controller.ts`). Unlike Ward, citadel's `logoff.json` is `@Public()`, so `logout` opts out too. Authenticated methods (`listAuthorizationRequests`, `authorizeAuthorizationRequest`, `denyAuthorizationRequest`, `updateAccount`, and every `AdminClient` method) keep the default behavior.

### B. Failed recovery rejects instead of resolving `undefined`

When recovery fails (no stored refresh token, the refresh call fails, or the retried request answers `401` again), `ApiClient` still clears the session and opens the login modal, but then **throws** the `ApiError` built from the *original* `401` response, marked so consumers can tell it apart from a real error:

```js
function sessionExpired(error) {
  AuthSession.clear();

  if (typeof window !== 'undefined') {
    LoginModalEvents.open('password');
  }

  error.sessionExpired = true;

  throw error;
}

async function handleUnauthorized(method, path, body, originalError) {
  const refreshToken = AuthSession.get();

  if (!refreshToken) {
    return sessionExpired(originalError);
  }

  const refreshResponse = await request('POST', REFRESH_PATH, { refreshToken });

  if (!refreshResponse.response.ok) {
    return sessionExpired(originalError);
  }

  AuthSession.set(refreshResponse.data.refreshToken);

  return sendJson(method, path, body, { isRetry: true, originalError });
}
```

- `ApiError` gets a `sessionExpired = false` field in its constructor.
- New helper `frontend/assets/js/client/isSessionExpired.js`: `error instanceof ApiError && error.sessionExpired === true`.
- Remove the "`undefined` when the session turned out to be expired" contract from the JSDoc of `sendJson`, `handleUnauthorized`, `sessionExpired` and every public `ApiClient` method.

**Design decision:** consumers check `isSessionExpired(error)`, **not** `status === 401`. A `401` from an opted-out public route (wrong password, invalid reset token) is a real error that must be shown; only the rejection produced by a failed *recovery* is silent.

### C. Consumer sweep

Because the client now rejects, callers drop any guard that existed only to absorb the silent `undefined` (`if (!result)`, `result && result.x`, `!== undefined`, ...), and every `catch` that renders an error stays quiet on `isSessionExpired(error)` (the login modal is already open) while still resetting its pending/loading/confirm state:

```js
try {
  const result = await send(payload);
  this.applySuccess(result);
} catch (error) {
  if (!isSessionExpired(error)) {
    this.handleSubmitError(error);
  }
}
```

Consumers to review in citadel:

- `components/resources/admin/pages/controllers/AdminUsersController.js`
- `components/resources/admin/pages/controllers/AdminUserEditController.js`
- `components/resources/accounts/pages/controllers/MyAccountController.js`
- `components/resources/accounts/pages/controllers/AuthorizationRequestsController.js`
- `components/resources/accounts/pages/controllers/RegisterController.js`
- `components/common/awaitingApproval/controllers/AwaitingApprovalController.js`
- `components/common/header/controllers/HeaderController.js`
- `components/common/loginModal/controllers/LoginModalController.js`
- `utils/polling/AuthorizationRequestPoller.js` — `dispatchPollResult` drops its falsy-result defence (`(result && result.status) || 'open'` → `result.status || 'open'`); the poll route is public, so a `401` now rejects as a normal `ApiError` and is handled by the existing error branch.

`LoginErrorMessages.forLogin` needs **no change**: it maps `403 USER_DENIED` and falls back to `error.message`, which is now the backend's `Invalid username or password`.

### Order

Do (1) the `ApiClient` opt-out + reject-on-expiry + `ApiError` flag + helper, (2) the `AccountsClient` public routes, and (3) the consumer sweep together: step 1 alone changes behavior for every consumer and would show spurious errors next to the login modal. Then (4) the end-to-end wrong-password specs and (5) docs.

### Specs (Jasmine)

- `ApiClient`, opt-out: for all four verbs, an opted-out `401` rejects with an `ApiError` carrying the body's code/message, `sessionExpired === false`, makes exactly one request, and never calls `AuthSession.get/set/clear` or `LoginModalEvents.open`.
- `ApiClient`, default routes: all three failed-recovery paths (no refresh token / refresh call fails / retry `401` again) clear the session, open the modal **and reject** with an `ApiError` (`401`, `UNAUTHORIZED`, `sessionExpired === true`). Existing specs asserting a resolved `undefined` are flipped.
- `ApiError`: `sessionExpired` defaults to `false`.
- `isSessionExpired`: true only for an `ApiError` with the flag set.
- `AccountsClient`: each public method passes the opt-out; authenticated methods do not.
- Login modal end-to-end regression, through the **real** `AccountsClient` + `ApiClient` with only `fetch` stubbed:
  - wrong password, no stored refresh token → `setSubmitError('Invalid username or password')`, one request to `/auth/login.json`, no `AuthSession.set/clear`, no `LoginModalEvents.open/close`, no `AuthEvents.emit`;
  - wrong password, valid stored refresh token → same message, no refresh request, token neither rotated nor cleared;
  - `403 USER_DENIED` still shows `This account has been denied access.`
- Consumer specs: changed from "client resolves `undefined`" to "client rejects with a session-expired error", asserting no error is shown and pending state is reset.
- Run the frontend test suite and linter (through `docker-compose`).

### Docs

- `docs/agents/architecture/frontend.md` — "Auth flow" (recovery now rejects, `skipAuthRecovery`, which routes are public), "Login modal" (wrong password shows `Invalid username or password`), "API errors" (`sessionExpired` field, `isSessionExpired`, consumers stay silent on expiry).
- `docs/agents/flow.md` — "Session renewal".
- `docs/agents/backend/routes/auth.md` — next to the existing `403` carve-out: public-route `401`s never trigger refresh-and-retry.

## Benefits

- Users see the real credential error instead of a JavaScript exception.
- A mistyped password no longer silently logs out an existing session.
- `ApiClient` callers get a consistent contract: they always get data or a rejected `ApiError`, never a silent `undefined`.
