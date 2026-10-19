# Awaiting-approval view and Header wiring

While pending, the app content is replaced by an "Awaiting approval" page, and the header shows no
auth links.

New folder `components/common/awaitingApproval/`, following the controller/helper/hook split used
by `header/` and mirroring Kerghan's
[awaitingApproval/](https://github.com/darthjee/kerghan/tree/main/frontend/assets/js/components/common/awaitingApproval):

- `AwaitingApprovalGate.jsx`: `({ pending, onLogout, children })` renders `<AwaitingApproval />`
  while `pending`, and `children` otherwise.
- `AwaitingApproval.jsx`: builds an `AwaitingApprovalController` (`useMemo`), keeps an `error`
  state, uses `useWindowFocusRecheck`, and renders through the helper.
- `controllers/AwaitingApprovalController.js`:
  - `checkAgain()` clears the error, then calls `AuthStatus.refresh(client)`; on failure it sets
    "Could not check your account status, please try again."
  - `logout()` calls the header's existing logout. Reuse `HeaderController#handleLogout`, or the
    `onLogout` passed down from `Header`: `DELETE /auth/logoff.json`, `AuthSession.clear()`, emit
    logged out, redirect home.
- `helpers/AwaitingApprovalHelper.jsx`: renders:
  - title "Awaiting approval";
  - text "Your account is waiting for an administrator's approval.";
  - the error, if any;
  - **Check again** and **Log out** buttons (react-bootstrap, like the rest of the app).
- `hooks/useWindowFocusRecheck.js`: a `buildWindowFocusEffect(recheck)` plain function plus the
  hook, like `useAuthEffect`. It subscribes to `window` `focus`, calls `recheck`, and unsubscribes
  on cleanup. **No timer.**

Header:

- `components/common/header/Header.jsx`:
  - adds `const [pending, setPending] = useState(false)`, passed in `setters`;
  - wraps `children` in `<AwaitingApprovalGate pending={pending} onLogout={handleLogout}>`.
- `components/common/header/helpers/HeaderHelper.jsx`: `render(isLoggedIn, isAdmin, onLogout,
  onOpenLogin, pending = false)`. While pending, `renderAuthLinks` returns nothing: no login links
  and no logged-in menu. The brand stays.

Specs (mirror Kerghan's
[awaitingApproval specs](https://github.com/darthjee/kerghan/tree/main/frontend/specs/assets/js/components/common/awaitingApproval)):

- `AwaitingApprovalGateSpec`: renders the view while pending and `children` otherwise.
- `AwaitingApprovalSpec`: renders the title, text and both buttons.
- `AwaitingApprovalControllerSpec`:
  - `checkAgain` calls `AuthStatus.refresh`;
  - `checkAgain` shows the error text on failure and clears it on retry;
  - `logout` calls the existing logout.
- `AwaitingApprovalHelperSpec`: renders the content and the error.
- `useWindowFocusRecheckSpec`: re-checks on focus, never on a timer (`jasmine.clock` tick causes no
  call), and unsubscribes on cleanup.
- `HeaderSpec` and `HeaderHelperSpec`: the pending state hides the auth links and shows the view.

## Files to Change
- `frontend/assets/js/components/common/awaitingApproval/AwaitingApprovalGate.jsx` — new.
- `frontend/assets/js/components/common/awaitingApproval/AwaitingApproval.jsx` — new.
- `frontend/assets/js/components/common/awaitingApproval/controllers/AwaitingApprovalController.js` — new.
- `frontend/assets/js/components/common/awaitingApproval/helpers/AwaitingApprovalHelper.jsx` — new.
- `frontend/assets/js/components/common/awaitingApproval/hooks/useWindowFocusRecheck.js` — new.
- `frontend/assets/js/components/common/header/Header.jsx` — `pending` state and gate.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — no auth links while pending.
- Matching specs under `frontend/specs/assets/js/components/common/awaitingApproval/` (new) and
  `frontend/specs/assets/js/components/common/header/`.
