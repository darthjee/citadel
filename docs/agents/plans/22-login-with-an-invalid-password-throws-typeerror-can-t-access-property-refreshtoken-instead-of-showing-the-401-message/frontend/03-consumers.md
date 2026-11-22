# Consumers: handle session-expired rejection

Apply the rule everywhere a caller of an authenticated route renders an error: in each `catch`,
`if (isSessionExpired(error)) { reset pending state; return; }` before showing anything, and
remove the `!result` / `undefined` guards and their "expired session" JSDoc. Ward reference:
`AccountEditFormController.js`, `AuthorizationRequestsController.js`, `AdminUsersController.js`
at `aa398da`.

- `components/common/forms/controllers/AccountEditFormController.js` `#send`: drop the
  `if (!result) return;` guard; in the `catch`, skip `handleSubmitError` on
  `isSessionExpired(error)`. This covers `MyAccountController` and `AdminUserEditController`
  save paths (both subclasses). Check the subclasses' `handleSubmitError` overrides, if any,
  are not reached on session expiry.
- `components/resources/accounts/pages/controllers/AuthorizationRequestsController.js`: `load`
  (drop guard, skip `setLoadError` on expiry) and `#performRowAction` (drop guard, skip the row
  error on expiry); update the `#performRowAction` JSDoc that mentions the `undefined` result.
- `components/resources/admin/pages/controllers/AdminUsersController.js`: `#handleTopLevelError`
  and `#handleRowError` return early on `isSessionExpired(error)`, next to the existing
  `redirectIfForbidden` check. (Today these show the `TypeError` from destructuring `undefined`.)

No change is expected in: `HeaderController` (swallows logout errors), `AwaitingApprovalController`
(`status` is now public, so a 401 is a real check failure), `RegisterController`, and the
`LoginModalController` register/reset/device paths (all public routes, so showing
`error.message` is correct). Re-check each with a grep before concluding; any other caller found
reading the resolved value of an authenticated call gets the same treatment.

Specs: migrate the `undefined`-resolve cases to session-expired rejections (using
`specs/support/sessionExpiredError.js`) in `AccountEditFormControllerSpec.js`,
`specs/support/accountEditFormControllerExamples.js`, `AuthorizationRequestsControllerSpec.js` and
`AdminUsersControllerSpec.js` (or a sibling `AdminUsersControllerSessionExpiredSpec.js` if it
would exceed 300 lines). Each asserts that no error message is set and pending state is reset.
Also check `useAccountEditFormSpec.js` and `AdminUsersSpec.js`, which reference `undefined`.

## Files to Change
- `frontend/assets/js/components/common/forms/controllers/AccountEditFormController.js`
- `frontend/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsController.js`
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUsersController.js`
- Their specs under `frontend/specs/assets/js/components/` and `frontend/specs/support/accountEditFormControllerExamples.js`
