# Denied login message

On `403 USER_DENIED` from `login.json`, the login modal shows "This account has been denied
access." The text is owned by the frontend, so it does not depend on the backend wording.

- New `components/common/loginModal/controllers/LoginErrorMessages.js`:
  - `export const USER_DENIED_MESSAGE = 'This account has been denied access.'`;
  - `LoginErrorMessages.for(error)` (Kerghan's name, if it differs, wins) returns
    `USER_DENIED_MESSAGE` when `error.code === 'USER_DENIED'`, and `error.message` otherwise.
- `LoginModalController#submitPassword`'s `catch` uses it for `setSubmitError`. Other modes keep
  `error.message`.
- `ApiClient` already skips refresh-and-retry on a `403`; no change.

Specs:
- New `LoginErrorMessagesSpec.js` covers the mapping and the fallback.
- New `LoginModalControllerDeniedSpec.js`, mirroring
  [Kerghan's](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerDeniedSpec.js).
  It covers that a `USER_DENIED` login shows the message, emits nothing and keeps the modal open,
  and that other errors keep their message.

## Files to Change
- `frontend/assets/js/components/common/loginModal/controllers/LoginErrorMessages.js` — new.
- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — use it
  in the password `catch`.
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginErrorMessagesSpec.js` — new.
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerDeniedSpec.js` — new.
