# Architecture — Frontend

React 19 + Vite, built and tested the same way regardless of backend language. Hash-based
routing, a `client/` HTTP layer, and a login/register/device-authorization modal already exist
(see "Auth flow" below) — application-specific views are left to each project built from this
template.

## Stack

- React 19 (no React Bootstrap/UI kit chosen yet)
- Vite (dev server on port 8080, `npm run build` outputs to `dist/`, matching the
  `docker_volumes/static` bind mount)
- Jasmine + c8 (tests/coverage), driven through a custom Node ESM loader
  (`specs/support/jsx-loader.mjs`) that transforms `.jsx` via Babel, stubs image/CSS imports,
  and shims `import.meta.env` for Node-based specs
- ESLint (flat config, `eslint.config.mjs`) — 2-space indent, single quotes, semicolons
  required, max complexity 10, max 300 lines/file, JSDoc required on public API

## Directory layout (current)

```
frontend/assets/js/
  App.jsx, main.jsx           # entry point — mounts App into #root
  components/
    AppController.js          # resolves the current route, renders the matching page
    common/
      header/                 # Header.jsx + controller/helper/hook — Login/Logout nav
      awaitingApproval/       # AwaitingApprovalGate.jsx, AwaitingApproval.jsx + controller/
                              #   helper/hooks/useWindowFocusRecheck.js — pending-account view
      loginModal/             # LoginModal.jsx — route-independent, opened via LoginModalEvents
                              #   (controllers/LoginErrorMessages.js maps error codes to text)
      ModalRedirect.jsx       # #/login, #/register → open the modal in that mode
      forms/                  # shared account-edit form pieces: helpers/ (JSX),
                              #   controllers/AccountEditFormController.js (base class for
                              #   MyAccountController / AdminUserEditController) and
                              #   hooks/useAccountEditForm.js (shared state/handler wiring
                              #   for MyAccount / AdminUserEdit)
    resources/
      home/pages/Home.jsx
      accounts/pages/          # AuthorizationRequests ("My account"), ResetPasswordLanding
      admin/pages/             # AdminUsers.jsx (search, status filter, approve/deny via
                               #   users/ApproveUserButton.jsx, users/DenyUserButton.jsx),
                               #   AdminUserEdit.jsx
  client/                      # AccountsClient, AdminClient, ApiClient, ApiError,
                                #   AuthSession, AuthEvents, AuthStatus, LoginModalEvents,
                                #   pickDefined.js (drops undefined keys from request bodies)
  utils/
    routing/                   # Router, Route, HashRouteResolver
    polling/AuthorizationRequestPoller.js
    validation/                # fieldValidators, formValidators (shared client-side form rules)

frontend/specs/                # mirrors assets/js/ above, one spec per source file
  support/jsx-loader.mjs
```

New application views should follow the shape already used above (`components/`, `client/`,
`utils/`) rather than inventing a new one — see `frontend.md` in `.claude/agents/` for the full
component-extraction conventions to apply as it grows.

## Auth flow

`client/AccountsClient.js` wraps every `auth` route the backend exposes — see
`docs/agents/modules/auth.md` for the request/response contract, not duplicated here:

- `register(fields)` — `POST /auth/register.json`
- `login({ username, password })` — `POST /auth/login.json`
- `refresh(refreshToken)` — `POST /auth/refresh.json`
- `logout(refreshToken)` — `DELETE /auth/logoff.json`
- `status(refreshToken)` — `POST /auth/status.json`
- `recover(email)` / `resetPassword(fields)` — `POST /auth/recover.json` / `POST /auth/reset-password.json`
- `createAuthorizationRequest(username)`, `pollAuthorizationRequest(uuid, pollToken)`,
  `listAuthorizationRequests()`, `authorizeAuthorizationRequest(uuid, password)`,
  `denyAuthorizationRequest(uuid)` — the device-authorization flow's five endpoints (see
  `docs/agents/modules/auth.md`'s "Device-authorization flow" section)

`register`/`login`/`refresh` and a winning `pollAuthorizationRequest` all persist the response's
`refreshToken` via `client/AuthSession.js` before resolving; `logout` clears it unconditionally,
even when the request itself fails, so the client-side session always ends. `AuthSession` is a
thin `localStorage` wrapper (`get`/`set`/`clear`/`isLoggedIn`) around a single key — the access
token itself is never touched by the frontend at all, since the backend sets it as an `httpOnly`
cookie (see `docs/agents/modules/auth.md`'s JWT/refresh-token flow).

`client/ApiClient.js` reacts to a `401` transparently rather than surfacing it to callers: it
reads the stored refresh token, calls `POST /auth/refresh.json` directly (a plain internal
request, not through `AccountsClient`, to avoid a circular import), persists the renewed
`refreshToken`, and retries the original request exactly once. If there is no stored refresh
token, or the refresh call itself fails (invalid/expired/already-revoked refresh token) or the
retried request comes back `401` again, `ApiClient` treats the session as expired: it clears
`AuthSession` and opens the login modal in Password mode via `client/LoginModalEvents.js`,
instead of resolving/rejecting the original call normally or redirecting to a dedicated route.

### Login modal

`components/common/loginModal/LoginModal.jsx` is the single, route-independent entry point for
every auth interaction — standalone login/register pages no longer exist. It is opened/closed
via the shared `client/LoginModalEvents.js` bus (from the header, from `ApiClient`'s
session-expired handling above, or from `components/common/ModalRedirect.jsx`, which the
`#/login` and `#/register` hash routes resolve to so a direct link still opens the modal in the
right mode) and driven by `LoginModalController`/`useLoginModal`/`useDeviceCountdown`. Its modes:

- **Password** / **Register** — the classic username/password flows; both converge on the same
  success path: re-check `status.json` through `AuthStatus.refresh` (see "User approval" below),
  close the modal, redirect home. A `403 USER_DENIED` login shows **"This account has been
  denied access."** (`LoginErrorMessages.forLogin` maps `error.code` to a frontend message,
  falling back to `error.message` for other codes).
- **Recover** / **Set-new-password** — `AccountsClient.recover`/`resetPassword`; the modal stays
  open on a neutral/success result panel instead of redirecting.
- **Authorize-with-logged-device** — drives `AccountsClient.createAuthorizationRequest` then
  hands off to `utils/polling/AuthorizationRequestPoller.js`, which polls
  `pollAuthorizationRequest` on a 5s cadence until the request is approved, rejected
  (`denied`/`expired`/`logged`), or a `404` (`notFound`) is thrown; a winning `approved` poll
  converges on the same success path as Password/Register. The modal shows a waiting panel with a
  countdown (driven by a 1s ticker down to the request's `expiresAt`) while polling, then its own
  terminal panel.

The approving device reviews and resolves open requests from the "My account" page
(`components/resources/accounts/pages/AuthorizationRequests.jsx` +
`AuthorizationRequestsController`/`AuthorizationRequestsHelper`), which calls
`AccountsClient.listAuthorizationRequests`/`authorizeAuthorizationRequest`/
`denyAuthorizationRequest` — see `docs/agents/modules/auth.md` for the backend contract behind
all of this.

`components/common/header/Header.jsx` keeps `loggedIn`/`isAdmin`/`pending` state in sync with
the shared `client/AuthEvents.js` bus (via `useAuthEffect`, confirmed at mount time through
`HeaderController#checkStatus`, which delegates to `AuthStatus.refresh`) rather than only reading
`AuthSession.isLoggedIn()` once at render time, so it reacts to any auth-state change (login,
logout, or a winning device-authorization poll) independently of a page redirect. It shows a
Login nav link when logged out, or a Logout action when logged in. Logging out calls
`AccountsClient.logout` and redirects home regardless of whether the request succeeded, since
`AccountsClient.logout` already clears `AuthSession` unconditionally.

## User approval

The frontend side of [User approval](../modules/auth/user-approval.md):

- **`pending` on the auth bus**: `AuthEvents.emit(loggedIn, isAdmin = false, pending = false)`;
  the event `detail` carries `pending`. While pending, `loggedIn` and `isAdmin` are `false`, so
  the header shows no logged-in menu.
- **`client/AuthStatus.js`**: `AuthStatus.refresh(client = AccountsClient)` is the single place
  that reads the stored refresh token, calls `status.json` and emits the result. Every re-check
  (header mount, after login/register, the awaiting-approval view) goes through it:

  | `status.json` answer | Stored refresh token | Emitted |
  |---|---|---|
  | `{ loggedIn: true, … }` | kept | `(true, isAdmin, false)` |
  | `{ loggedIn: false, …, status: "pending" }` | **kept**, so an approval is picked up without a new login | `(false, false, true)` |
  | anything else (denied, revoked, expired, unknown) | cleared (`AuthSession.clear()`) | `(false, false, false)` |
  | — (no stored token) | — (no request) | `(false, false, false)` |

- **Re-check after login and register**: `LoginModalController`'s shared success handler and
  `RegisterController` call `AuthStatus.refresh` instead of emitting a logged-in state from the
  response, so `status.json` is the single source of the status.
- **Awaiting-approval view** (`components/common/awaitingApproval/`): `Header.jsx` wraps the
  page content in `AwaitingApprovalGate`, which renders `AwaitingApproval` instead of the
  children while `pending`. The view shows **"Awaiting approval"**, **"Your account is waiting
  for an administrator's approval."** and two buttons: **Check again**
  (`AwaitingApprovalController#checkAgain` → `AuthStatus.refresh`; on failure **"Could not
  check your account status, please try again."**) and **Log out** (the header's logout).
  `useWindowFocusRecheck` re-checks on every window **focus** while the view is shown — **no
  timer polling**, since `status.json` is never cached and hits the DB. Because `status.json`
  is passive, several open tabs each re-check on their own focus without logging each other
  out. A re-check answering `loggedIn: true` swaps back to the app with no new login; an
  anonymous answer (denied, expired) switches to the normal logged-out state, without saying the
  account was denied.
- **Admin users page** (`components/resources/admin/pages/AdminUsers.jsx`, its controller and
  helper): a **status filter** next to the search box (`All` sends no `status`; `Pending`,
  `Approved`, `Denied`), a **Status** column, an **Approve** button on `pending` rows only
  (`users/ApproveUserButton.jsx`) and a **Deny** button (`users/DenyUserButton.jsx`) hidden on
  the admin's own row (`user.id === currentUserId`) and on `denied` rows, behind
  `window.confirm('Deny this user? This is final and logs them out everywhere.')` — cancelling
  sends nothing. `AdminClient.searchUsers(q, status)` resolves `{ users, currentUserId }`;
  `approveUser(id)` / `denyUser(id)` resolve `{ user }`, and a successful action replaces the
  row with the returned user. Errors (`422`, `404`, a demoted admin's `403`) show their
  `error.message` in the row's result area (`rowResults`); the existing per-row recovery and
  edit actions stay available for every status.

## API errors

Any non-`401` failure from `client/ApiClient.js` rejects with a `client/ApiError.js`, built from
the backend's standard error body (`{ error: { code, message, details? }, statusCode, timestamp }`
— see `architecture/backend.md`'s `## Error responses` section for the format and the
status-to-code mapping):

- `status` — the HTTP status of the response.
- `message` — `error.message`, human-readable and safe to show in the UI. When the body carries
  none (empty or non-JSON body, e.g. a proxy-generated error page), it falls back to the
  response's `statusText`, then to `'Request failed'`, so it is never `undefined`.
- `code` — `error.code` (e.g. `USERNAME_TAKEN`, `EMAIL_TAKEN`, `VALIDATION_FAILED`, `NOT_FOUND`);
  prefer branching on it over matching `message` text. `undefined` when the body carries none.
- `details` — `error.details`, the full list of validation messages; only present on validation
  failures, `undefined` otherwise.

## No Vite proxy to the backend

There is no Vite `server.proxy` config pointing at the backend — that's the Tent proxy's job
(see `architecture/proxy.md`), not Vite's. In dev, Tent forwards non-asset requests to the Vite
dev server for HMR; Vite itself never talks to the backend directly.

See `.claude/agents/frontend.md` for local dev commands, code conventions, and the JSX
extraction rules.
