# Page, helper and approve / deny buttons

**`AdminUsers.jsx`**
- New `status` state (`''` means all) and `currentUserId` state (`null`).
- Pass `setCurrentUserId` to the controller.
- `handleStatusChange`.
- Submit calls `controller.handleSearch(query, status || undefined)`.
- New `onApprove(userId)` and `onDeny(userId)` handlers, in the same curried shape as
  `onGenerateLink`.

**`helpers/AdminUsersHelper.jsx`**
- Search form: a status `<select>` (`form-select`) next to the input, with options All (`''`),
  Pending, Approved, Denied.
- Table: a **Status** column showing `user.status`.
- Row actions keep Edit, Generate link and Send email for every status, and add:
  - `<ApproveUserButton user={user} onApprove={…} />`;
  - `<DenyUserButton user={user} currentUserId={currentUserId} onDeny={…} />`.
- Update the JSDoc for the new state and handlers.

**New `users/ApproveUserButton.jsx`**
- Renders an Approve button (`btn btn-sm btn-success me-2`) only when `user.status === 'pending'`,
  and `null` otherwise.

**New `users/DenyUserButton.jsx`**
- Renders a Deny button (`btn btn-sm btn-danger me-2`), and `null` when
  `user.id === currentUserId` or `user.status === 'denied'`.
- The confirm lives in the controller (step 02), so the button only calls `onDeny`.

Specs, mirroring Kerghan's
[AdminUsersSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/AdminUsersSpec.js),
[AdminUsersHelperSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUsersHelperSpec.js),
[ApproveUserButtonSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/users/ApproveUserButtonSpec.js)
and [DenyUserButtonSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/components/resources/admin/pages/users/DenyUserButtonSpec.js):
- `AdminUsersHelperSpec` covers:
  - the status column and filter options;
  - Approve only on pending rows;
  - Deny hidden on the own row and on denied rows;
  - the existing actions still present for every status.
- `AdminUsersSpec` covers that the filter value reaches the search (none for All) and that
  approve and deny are wired.
- The button specs cover visibility and the click callback.

## Files to Change
- `frontend/assets/js/components/resources/admin/pages/AdminUsers.jsx` — `status` and
  `currentUserId` state, new handlers.
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx` — filter,
  status column, buttons.
- `frontend/assets/js/components/resources/admin/pages/users/ApproveUserButton.jsx` — new.
- `frontend/assets/js/components/resources/admin/pages/users/DenyUserButton.jsx` — new.
- `frontend/specs/assets/js/components/resources/admin/pages/AdminUsersSpec.js`,
  `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUsersHelperSpec.js` — update.
- `frontend/specs/assets/js/components/resources/admin/pages/users/ApproveUserButtonSpec.js`,
  `frontend/specs/assets/js/components/resources/admin/pages/users/DenyUserButtonSpec.js` — new.
