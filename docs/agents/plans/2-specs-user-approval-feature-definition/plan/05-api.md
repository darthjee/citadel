# Auth and admin API

Write the two API files, carrying over the request / response bodies, adapted to Citadel
(refresh token in the request body; no default user).

`api/auth.md` (implemented by #5), from §7:

- Table of the `@Public()` endpoints that read the real status and why.
- `login.json` order of checks (`403 USER_DENIED` only after the password).
- `register.json` status from `UserApprovalConfig`.
- `status.json` with `{ refreshToken }` in the body: the four answers; `status` only for
  `pending`; pending keeps the session; denied → anonymous answer + token revoked
  `admin_denied`.
- `refresh.json`: existing checks first; pending rotates; denied → revoke `admin_denied`, plain
  `401`, no replay detection.
- `recover.json` / `reset-password.json`: denied treated as unknown; pending can reset and stays
  pending; denied token → generic `400`, not consumed.
- Device-authorization poll: re-check before minting, `logged → denied` conditional transition;
  `authorize.json` needs no check (gate).
- Reference + Required tests (login / register / recovery / refresh / status / poll specs).

`api/admin.md` (implemented by #6), from §9:

- `AdminController` conventions (thin, `AdminService`, `@AdminOnly()`, never cached, always
  available); admin user item with `status`.
- `search.json` (`q` + `status` filter, `@IsIn`, `currentUserId`), `approve.json` (conditional
  update, `404`, `422`), `deny.json` (`404`, `422 CANNOT_DENY_SELF`, any status, revokes every
  active token with `admin_denied`, admins can deny admins).
- Admin edge cases: self-deny refused; admin demoted/denied while on the page → next call `403` /
  `401`.
- Reference + Required tests (admin service spec, admin controller e2e).

## Files to Change
- `docs/agents/specs/user-approval/api/auth.md` — new.
- `docs/agents/specs/user-approval/api/admin.md` — new.
