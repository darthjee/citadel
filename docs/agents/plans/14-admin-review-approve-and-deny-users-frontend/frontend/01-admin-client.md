# AdminClient: status filter, approve, deny

- `searchUsers(q, status)` posts `pickDefined({ q, status })` (`client/pickDefined.js`), so
  `status` is sent only when given.
  - It already resolves the whole body; the body is now `{ users, currentUserId }`.
  - Update the JSDoc: user items carry `status`, and the response has `currentUserId`.
- `approveUser(userId)` posts `{}` to `/admin/users/${userId}/approve.json` and resolves `{ user }`.
- `denyUser(userId)` posts `{}` to `/admin/users/${userId}/deny.json` and resolves `{ user }`.

Specs (`AdminClientSpec`, mirroring Kerghan's
[AdminClientSpec.js](https://github.com/darthjee/kerghan/blob/main/frontend/specs/assets/js/client/AdminClientSpec.js)):
- `searchUsers` sends `status` only when given, and no `q` when `q` is undefined;
- `approveUser` / `denyUser` hit the right URLs with `{}` and resolve the body.

## Files to Change
- `frontend/assets/js/client/AdminClient.js` — `status` argument, `approveUser`, `denyUser`.
- `frontend/specs/assets/js/client/AdminClientSpec.js` — cases above.
