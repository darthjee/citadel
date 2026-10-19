# Controller: filter, currentUserId, approve and deny

`components/resources/admin/pages/controllers/AdminUsersController.js`:

- Constructor: add a `setCurrentUserId` setter. Prefer an options object if the positional list
  gets too long; keep `client` overridable for tests. Also take an injectable `confirm`, defaulting
  to `(message) => window.confirm(message)`, so specs never touch the real dialog.
- `handleSearch(q, status)`:
  - `status` is `undefined` for "all";
  - calls `this.client.searchUsers(q, status)`;
  - then `setUsers(users)` and `setCurrentUserId(currentUserId)`.
- `handleApprove(userId)`: `approveUser(userId)`, then replaces the row with the returned user.
  Errors go through `#handleRowError`, which shows `error.message` in the row and leaves the row
  unchanged; a `403` still redirects.
- `handleDeny(userId)`:
  - asks `this.confirm('Deny this user? This is final and logs them out everywhere.')`;
  - on cancel, returns without a request;
  - otherwise behaves like approve, with `denyUser`.
- New private `#replaceUser(user)`:
  `this.setUsers((current) => current.map((u) => (u.id === user.id ? user : u)))`. It also clears
  that row's previous `rowResults` entry (e.g. a stale error), as Kerghan does if it differs.
- Export the confirm text as a constant (e.g. `DENY_CONFIRM_MESSAGE`) for specs.

Specs (`AdminUsersControllerSpec`, mirroring Kerghan's
[AdminUsersControllerSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUsersControllerSpec.js)):
- search passes `status`, sends none for "all", and stores `currentUserId`;
- approve and deny replace the row on success;
- `422` shows its message in `rowResults` with `users` unchanged;
- a cancelled confirm sends no request;
- a `403` redirects (existing behaviour).

## Files to Change
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUsersController.js` —
  filter, `currentUserId`, approve, deny, row replacement.
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUsersControllerSpec.js` — update and extend.
