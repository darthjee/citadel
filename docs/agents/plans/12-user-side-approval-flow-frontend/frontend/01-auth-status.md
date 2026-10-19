# Pending on the auth bus and AuthStatus

Carry `pending` on the auth bus and centralise the `status.json` handling in one module, reused
by every re-check.

- `client/AuthEvents.js`: `emit(loggedIn, isAdmin = false, pending = false)`; `detail` gains
  `pending`. Update the JSDoc.
- `components/common/header/hooks/useAuthEffect.js`: `buildAuthEffect` also calls an **optional**
  `setPending?.(Boolean(event.detail?.pending))`, so existing callers without it keep working.
- New `client/AuthStatus.js`, a plain object module like `AuthEvents`:
  `AuthStatus.refresh(client = AccountsClient)`.
  - No stored token (`AuthSession.get()`): emit `(false, false, false)` with no request.
  - Otherwise call `client.status(token)`:
    - `loggedIn: true` → keep the token, emit `(true, isAdmin, false)`;
    - `status === 'pending'` → **keep** the token, emit `(false, false, true)`;
    - anonymous → `AuthSession.clear()`, emit `(false, false, false)`.
  - Errors propagate (the caller decides).
- `components/common/header/controllers/HeaderController.js`: `checkStatus()` becomes
  `return AuthStatus.refresh(this.client)`. Update the JSDoc.

Specs:
- `AuthEventsSpec` covers `pending`, default `false`.
- New `client/AuthStatusSpec.js` covers the four cases above, including that the token is kept on
  pending and that no request is made without a token. Mirror Kerghan's
  [AuthStatusSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/client/AuthStatusSpec.js).
- `HeaderControllerSpec` checks `checkStatus` delegates to `AuthStatus.refresh`; adjust the
  existing status cases.
- `useAuthEffectSpec` checks `setPending` is called when given and the effect works without it.

## Files to Change
- `frontend/assets/js/client/AuthEvents.js` — `pending` argument.
- `frontend/assets/js/client/AuthStatus.js` — new.
- `frontend/assets/js/components/common/header/hooks/useAuthEffect.js` — optional `setPending`.
- `frontend/assets/js/components/common/header/controllers/HeaderController.js` — delegate.
- `frontend/specs/assets/js/client/AuthEventsSpec.js`, `frontend/specs/assets/js/client/AuthStatusSpec.js` (new),
  `frontend/specs/assets/js/components/common/header/controllers/HeaderControllerSpec.js`,
  `frontend/specs/assets/js/components/common/header/hooks/useAuthEffectSpec.js`.
