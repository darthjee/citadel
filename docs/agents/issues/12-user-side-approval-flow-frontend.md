# Issue: User-side approval flow (frontend)

## Description

Part of the user-approval Epic (#1); split from #5, which shipped the backend side (user status,
the `status.json` `pending` answer, login `403 USER_DENIED`). Implements
[ui/user.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/ui/user.md):
the frontend's awareness of a pending account and of a denied login.

Until this ships, `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` must stay off: with no pending
users, the current frontend is unaffected by #5.

## Problem

The frontend ignores the new account states. `HeaderController#checkStatus` reads only
`{ loggedIn, isAdmin }` and clears the stored refresh token on any `loggedIn: false`, so a pending
user loses their session and gets no explanation. Login and register emit a logged-in state
straight from the response, so a pending user looks logged in while every business call answers
`401`. A denied login shows the raw backend message.

## Expected Behavior

- A pending user who logs in or registers sees an "Awaiting approval" page instead of the app, with
  Check again and Log out, and no auth links in the header.
- The pending session's refresh token is kept. An approval is picked up on Check again or on window
  focus, with no new login and **no timer polling**.
- A re-check that answers anonymously (denied, expired) drops to the normal logged-out state.
- A denied login (correct password) shows "This account has been denied access."

## Solution

Under `frontend/assets/js/`:

- `client/AuthEvents.js`: `emit(loggedIn, isAdmin = false, pending = false)`;
  `components/common/header/hooks/useAuthEffect.js` tracks `pending` (optional `setPending`).
- New `client/AuthStatus.js` (`AuthStatus.refresh(client = AccountsClient)`): replaces the body of
  `HeaderController#checkStatus`; keeps the stored refresh token on the `pending` answer, drops it
  on the anonymous one, emits `(loggedIn, isAdmin, status === 'pending')`.
- Login and register success (`LoginModalController`'s shared success handler, `RegisterController`)
  re-check `status.json` through `AuthStatus.refresh` instead of emitting logged-in from the
  response.
- New `components/common/awaitingApproval/` (`AwaitingApprovalGate.jsx`, `AwaitingApproval.jsx`,
  `controllers/AwaitingApprovalController.js`, `helpers/AwaitingApprovalHelper.jsx`,
  `hooks/useWindowFocusRecheck.js`): "Awaiting approval" page with Check again / Log out,
  re-check on window focus, **no timer polling**. Log out reuses the header's existing logout.
- `Header.jsx`: a `pending` state next to `loggedIn` / `isAdmin`, wraps the content in
  `AwaitingApprovalGate`, and `HeaderHelper.render` shows no auth links while pending.
- New `loginModal/controllers/LoginErrorMessages.js`: `USER_DENIED` → "This account has been
  denied access."; other codes keep `error.message`.

Header initial state, as in Kerghan: `loggedIn` starts from `AuthSession.isLoggedIn()` and
`pending` from `false`, so a pending user briefly renders as logged in until the mount-time check
resolves (accepted: the gate keeps every business call at `401`).

Kerghan reference: commit [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e) —
[Header.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/common/header/Header.jsx),
[AuthStatus.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/client/AuthStatus.js),
[awaitingApproval/](https://github.com/darthjee/kerghan/tree/main/frontend/assets/js/components/common/awaitingApproval).

### Tests

The [ui/user.md → Required tests](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/ui/user.md#required-tests)
list, mirroring Kerghan's specs.

### Out of scope

- Admin UI (status filter, approve, deny): #14 (backend: #6).
- Docs, including pointing the spec's "Implemented by" lines at #12 / #14: #7.
- Backend changes: none needed (#5 is merged).

### Agents

frontend.

## Acceptance criteria

- A pending user who logs in or registers sees the awaiting-approval view; the stored refresh token
  is kept; approval is picked up on Check again or window focus without a new login.
- A denied login shows "This account has been denied access."
- `yarn coverage` and `yarn lint` pass in the frontend (through `docker-compose`).
