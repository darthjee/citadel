# Re-check status after login and register

`status.json` is the single source of the account status. After a successful register or login,
the frontend re-checks it instead of emitting a logged-in state from the response. The responses
themselves are unchanged.

- `components/common/loginModal/controllers/LoginModalController.js`: `#handleSuccess` becomes
  async. It does `await AuthStatus.refresh(this.client)`, then `LoginModalEvents.close()` and
  `redirectHome()`.
  - `#submitPassword` and `#submitRegister` `await` it.
  - The approved-device `onApproved` callback calls it too; the device path never yields a
    pending session, but it shares the handler.
  - The `result` argument is no longer needed for the emit. Update the JSDoc.
  - A failing re-check falls into the existing `catch` → `setSubmitError(error.message)` for
    password and register.
- `components/resources/accounts/pages/controllers/RegisterController.js`: replace
  `AuthEvents.emit(true, result.user.isAdmin)` with `await AuthStatus.refresh(this.client)`
  before `redirectHome()`. The `AuthEvents` import is dropped if unused.
- A pending answer emits `pending: true`, and the Header (step 04) swaps to the awaiting-approval
  view.

Specs:
- New `components/common/loginModal/controllers/LoginModalControllerStatusRecheckSpec.js`, mirroring
  [Kerghan's](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerStatusRecheckSpec.js).
  It covers that password and register success call `status.json` and emit from its answer
  (approved → logged in, pending → `pending: true`), with no direct emit from the login response.
- Adjust the existing `LoginModalControllerSpec` and `RegisterControllerSpec` expectations that
  assert `AuthEvents.emit(true, isAdmin)` from the response; stub `client.status`.

## Files to Change
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — async
  shared success handler through `AuthStatus.refresh`.
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js` —
  re-check through `AuthStatus.refresh`.
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerStatusRecheckSpec.js` — new.
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerSpec.js`,
  `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RegisterControllerSpec.js` — update.
