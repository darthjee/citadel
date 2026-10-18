# Admin UI

Back to the [feature README](../README.md).

Implemented by #6. Paths are under `frontend/assets/js/`; specs mirror them under
`frontend/specs/assets/js/`. Builds on the API in [api/admin.md](../api/admin.md).

## `AdminClient`

`client/AdminClient.js` gains / changes:

```js
searchUsers(q, status)  // POST /admin/users/search.json, pickDefined({ q, status })
approveUser(userId)     // POST /admin/users/:id/approve.json, {}
denyUser(userId)        // POST /admin/users/:id/deny.json, {}
```

`searchUsers` now resolves the whole response (`{ users, currentUserId }`), not only `users`;
every caller is updated accordingly. `approveUser` / `denyUser` resolve `{ user }`.

## Admin users page

`components/resources/admin/pages/AdminUsers.jsx`, its controller
(`controllers/AdminUsersController.js`) and helper (`helpers/AdminUsersHelper.jsx`). The approve /
deny buttons may live in their own components (`users/ApproveUserButton.jsx`,
`users/DenyUserButton.jsx`) to keep each file under the 300-line / complexity-10 limits.

- **Status filter** next to the search box: `all` (no `status` sent), `pending`, `approved`,
  `denied`. Combined with the search term on submit.
- **Status column** for each user.
- **Approve** button only on `pending` rows.
- **Deny** button behind `window.confirm('Deny this user? This is final and logs them out
  everywhere.')`; a cancelled confirmation sends nothing.
- **No action the API would refuse**: no deny on the admin's own row
  (`user.id === currentUserId`), no approve on non-pending rows, no deny on `denied` rows.
- **Errors** (`422 USER_NOT_PENDING`, `422 CANNOT_DENY_SELF`, `404`) show their `error.message`
  in the row's result area (e.g. after a concurrent change by another admin), reusing the
  existing per-row result mechanism (`rowResults`).
- After a successful action, the row is **replaced with the returned user**, so the status column
  and the available buttons update without a new search.
- The existing per-row actions (recovery link, send recovery email, edit) are unchanged and stay
  available for every status.

## Edge cases

- **Admin denied or demoted while on the page**: the next action answers `401` (denied: the
  gate, then the failed refresh ends in the logged-out state) or `403` (demoted: the error message
  shows in the row). No special handling beyond the existing error paths.
- **Concurrent change by another admin**: the stale row's action fails with `422`; its message is
  shown, and a new search shows the current status.

## Reference

All under kerghan `frontend/assets/js/`:

- [AdminClient.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/client/AdminClient.js)
- [AdminUsers.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/AdminUsers.jsx)
- [AdminUsersController.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/controllers/AdminUsersController.js)
- [AdminUsersHelper.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx)
- [ApproveUserButton.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/users/ApproveUserButton.jsx)
- [DenyUserButton.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/users/DenyUserButton.jsx)
- Kerghan commit [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e)

## Required tests

Mirroring Kerghan's
[AdminClientSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/client/AdminClientSpec.js),
[AdminUsersSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/AdminUsersSpec.js),
[AdminUsersControllerSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUsersControllerSpec.js),
[AdminUsersHelperSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUsersHelperSpec.js),
[ApproveUserButtonSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/users/ApproveUserButtonSpec.js)
and
[DenyUserButtonSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/users/DenyUserButtonSpec.js).

- `AdminClient.searchUsers` sends `status` only when given; `approveUser` / `denyUser` post to
  the right URLs with `{}`.
- The filter sends no `status` for `all`, and the selected value otherwise.
- The status column shows each user's status.
- Approve shows only on pending rows; deny is hidden on the admin's own row and on denied rows.
- Deny asks for confirmation; cancelling sends no request.
- A successful approve / deny replaces the row with the returned user.
- A `422` shows its message in the row and leaves the row unchanged.
