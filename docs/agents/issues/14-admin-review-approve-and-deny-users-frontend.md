# Issue: Admin review: approve and deny users (frontend)

## Description

Part of the user-approval Epic (#1). Frontend half of the admin review, split from #6; **depends on
#6** (admin API: `status` on admin user items, `currentUserId`, `approve.json`, `deny.json`).
Implements
[`ui/admin.md`](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/ui/admin.md).
Not gated by `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`. Implementation starts once #6 is merged.

## Problem

Once #6 ships, admins can approve and deny users only through the API: the admin users page
shows no status, has no status filter and no approve / deny actions.

## Expected Behavior

- The admin users page shows each user's status and filters by it.
- Approve and deny are available from each row, never offering an action the API would refuse.
- A failed action shows the API's message in its row; a successful one updates the row in place.

## Solution

Under `frontend/assets/js/`, specs mirrored under `frontend/specs/assets/js/`.

- `client/AdminClient.js`: `searchUsers(q, status)` (`pickDefined({ q, status })`; it already
  resolves the whole body, which now carries `{ users, currentUserId }`), `approveUser(userId)` and
  `denyUser(userId)` (`POST … {}`, resolve `{ user }`). JSDoc updated (`status` on user items).
- `AdminUsersController#handleSearch` keeps `currentUserId` next to `users` (new page state).
- `AdminUsers.jsx`, `controllers/AdminUsersController.js`, `helpers/AdminUsersHelper.jsx`:
  - status filter next to the search box: all (no `status` sent) / pending / approved / denied,
    combined with the term on submit;
  - status column;
  - Approve only on `pending` rows;
  - Deny behind `window.confirm('Deny this user? This is final and logs them out everywhere.')`;
    cancelling sends nothing;
  - no deny on the own row (`user.id === currentUserId`) or on `denied` rows;
  - errors (`422 USER_NOT_PENDING`, `422 CANNOT_DENY_SELF`, `404`) show `error.message` in the
    row result area (`rowResults`), leaving the row unchanged;
  - success replaces the row with the returned user;
  - existing row actions (recovery link, recovery email, edit) unchanged for every status.
- Approve / deny buttons in `users/ApproveUserButton.jsx` and `users/DenyUserButton.jsx` (as in
  Kerghan) to keep files under the 300-line / complexity-10 limits.
- No special handling for an admin denied (`401` → logged out) or demoted (`403` message in the
  row) while on the page: existing error paths cover it.

### Tests

*Required tests* of `ui/admin.md`: `searchUsers` sends `status` only when given;
`approveUser` / `denyUser` URLs and `{}` body; filter sends no `status` for all; status column;
button visibility (pending only, own row, denied rows); confirm cancel sends nothing; row replaced
on success; `422` message shown with the row unchanged.

Kerghan reference: commit [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e) —
[AdminClient.js](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/client/AdminClient.js),
[AdminUsers.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/AdminUsers.jsx),
[ApproveUserButton.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/users/ApproveUserButton.jsx),
[DenyUserButton.jsx](https://github.com/darthjee/kerghan/blob/main/frontend/assets/js/components/resources/admin/pages/users/DenyUserButton.jsx).

### Agents

frontend.

## Acceptance criteria

- Frontend specs cover the filter, button visibility, confirm cancel and error display.
- `yarn coverage` and `yarn lint` pass in the frontend (through `docker-compose`).
