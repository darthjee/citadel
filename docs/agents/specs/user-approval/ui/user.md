# User-side UI

Back to the [feature README](../README.md).

Implemented by #5. Paths are under `frontend/assets/js/`; specs mirror them under
`frontend/specs/assets/js/`.

## Auth state: `pending` on the bus

- `AuthEvents.emit(loggedIn, isAdmin = false, pending = false)` (`client/AuthEvents.js`): the
  event `detail` gains `pending`.
- While pending, `loggedIn` and `isAdmin` are `false`, so nothing that needs a logged-in user is
  shown and the header shows no logged-in menu.
- `components/common/header/hooks/useAuthEffect.js` also tracks `pending` (a `setPending` setter
  next to `setLoggedIn` / `setIsAdmin`).
- New `client/AuthStatus.js` with `AuthStatus.refresh(client = AccountsClient)`: reads the stored
  refresh token, calls `status.json`, applies the
  [refresh-token rule](#keeping-the-refresh-token) and emits
  `(loggedIn, isAdmin, status === 'pending')`. It replaces the body of
  `HeaderController#checkStatus` and is reused by every re-check below, so all of them treat the
  answer identically.

## Keeping the refresh token

The refresh token lives in `localStorage` (`client/AuthSession.js`). On a `status.json` answer:

| Answer | Stored refresh token |
|---|---|
| `{ loggedIn: true, … }` | kept |
| `{ loggedIn: false, …, status: "pending" }` | **kept** — the pending session must survive so an approval is picked up without a new login |
| `{ loggedIn: false, … }` (anonymous: denied, revoked, expired, unknown) | dropped (`AuthSession.clear()`), as today |

No stored token → no request, emit logged out (as today).

`Header` initialises `loggedIn` from `AuthSession.isLoggedIn()` (a stored token exists), so a
pending user briefly renders as logged in until the mount-time check resolves. Acceptable: the
gate keeps every business call at `401`, and the check flips to the awaiting-approval view on
mount. #5 may initialise from "unknown" instead if the flash is visible.

## After register and login

After a successful register or password login, the frontend **re-checks `status.json`**
(`AuthStatus.refresh`) instead of emitting a logged-in state from the response. The register and
login responses are unchanged; `status.json` is the single source of the status. Approved →
logged-in state; pending → awaiting-approval view.

Call sites: `components/common/loginModal/controllers/LoginModalController.js` (password and
register modes, the shared success handler) and
`components/resources/accounts/pages/controllers/RegisterController.js`. The device-authorization
success path never yields a pending session (the poll answers `denied` instead,
[api/auth.md](../api/auth.md#post-authauthorization-requestsuuidpolljson)), but it goes through
the same shared success handler and re-check.

## Awaiting-approval view

New folder `components/common/awaitingApproval/`:

| File | Role |
|---|---|
| `AwaitingApprovalGate.jsx` | Renders `<AwaitingApproval />` instead of `children` while `pending`. Wired in `components/common/header/Header.jsx`, which wraps the app content. |
| `AwaitingApproval.jsx` | Full page: title **"Awaiting approval"**, text **"Your account is waiting for an administrator's approval."**, buttons **Check again** and **Log out** |
| `controllers/AwaitingApprovalController.js` | `checkAgain()` → `AuthStatus.refresh`; on error shows **"Could not check your account status, please try again."**. `logout()` → the header's existing logout (`DELETE /auth/logoff.json`, then `AuthSession.clear()`) |
| `helpers/AwaitingApprovalHelper.jsx` | Rendering helper, per the frontend's controller/helper split |
| `hooks/useWindowFocusRecheck.js` | Calls `AuthStatus.refresh` on **window focus** while the view is shown; unsubscribes on unmount |

Rules:

- **No timer polling.** **Why:** `status.json` is never cached and hits the DB.
- **Several open tabs**: each re-checks on its own window focus, so an approval reaches them all
  without polling, and since `status.json` is passive, one tab's check never logs another out.
- A re-check answering `loggedIn: true` swaps back to the normal app, with **no new login**.
- A re-check answering anonymously (denied, expired) switches to the normal logged-out state;
  nothing says the account was denied.
- **Pending user's refresh token expires while waiting**: the next re-check answers anonymously →
  logged-out state; logging in again lands back on the awaiting-approval view.

## Denied login

On `403 USER_DENIED` from `login.json`, the login modal shows **"This account has been denied
access."**. New `components/common/loginModal/controllers/LoginErrorMessages.js` maps
`error.code` (`ApiError#code`) to a frontend message (`USER_DENIED_MESSAGE`), falling back to
`error.message` for any other code, so the text does not depend on the backend wording. Only
reachable after a correct password. A `403` does not trigger `ApiClient`'s refresh-and-retry.

## Reference

All under kerghan `frontend/assets/js/`:

- [AuthEvents.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/client/AuthEvents.js)
- [AuthStatus.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/client/AuthStatus.js)
- [AwaitingApprovalGate.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/awaitingApproval/AwaitingApprovalGate.jsx)
- [AwaitingApproval.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/awaitingApproval/AwaitingApproval.jsx)
- [AwaitingApprovalController.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/awaitingApproval/controllers/AwaitingApprovalController.js)
- [AwaitingApprovalHelper.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/awaitingApproval/helpers/AwaitingApprovalHelper.jsx)
- [useWindowFocusRecheck.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/awaitingApproval/hooks/useWindowFocusRecheck.js)
- [Header.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/header/Header.jsx)
- [LoginModalController.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js)
- [LoginErrorMessages.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/loginModal/controllers/LoginErrorMessages.js)
- [RegisterController.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js)
- Kerghan commit [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e)

## Required tests

Mirroring Kerghan's
[AuthStatusSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/client/AuthStatusSpec.js),
[awaitingApproval/](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/common/awaitingApproval)
(`AwaitingApprovalGateSpec.js`, `AwaitingApprovalSpec.js`,
`controllers/AwaitingApprovalControllerSpec.js`, `helpers/AwaitingApprovalHelperSpec.js`,
`hooks/useWindowFocusRecheckSpec.js`),
[LoginModalControllerStatusRecheckSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerStatusRecheckSpec.js)
and
[LoginModalControllerDeniedSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerDeniedSpec.js).

- `AuthEvents.emit` carries `pending` (default `false`).
- `AuthStatus.refresh`: approved → emits `(true, isAdmin, false)`, token kept; pending → emits
  `(false, false, true)`, token **kept**; anonymous → emits `(false, false, false)`, token
  cleared; no stored token → no request.
- `HeaderController#checkStatus` delegates to `AuthStatus.refresh`.
- `AwaitingApprovalGate` renders the view while pending and `children` otherwise.
- `AwaitingApproval` renders the title, text and both buttons.
- `AwaitingApprovalController#checkAgain` calls `AuthStatus.refresh` and shows the error text on
  failure; `logout` calls the existing logout.
- `useWindowFocusRecheck` re-checks on focus, never on a timer, and unsubscribes on unmount.
- Login and register success re-check `status.json` instead of emitting logged-in directly;
  a pending answer shows the awaiting-approval view.
- Login `403 USER_DENIED` shows "This account has been denied access."; other errors keep showing
  their message.
