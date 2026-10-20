# Security, frontend and env var docs

- `architecture/security.md`: the session-lookup gate as a security control, plus
  `security.md`'s non-disclosure rules (pending/denied look anonymous, identical `401`), races
  and accepted risks/costs (one indexed lookup per request).
- `architecture/frontend.md`: from `ui/user.md` — `pending` on the auth bus, `AuthStatus`, the
  re-check after login/register, the awaiting-approval gate and view with window-focus re-check,
  the denied login message; from `ui/admin.md` — the admin users page status filter, Status
  column, Approve (pending rows only) and Deny (not on the own row or denied rows, with a
  confirm) buttons. Update the file tree for the new components.
- `environment-variables.md`: the `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` row already exists;
  check it against `backend/src/auth/user-approval.config.ts` and link to `user-approval.md`.

## Files to Change
- `docs/agents/architecture/security.md` — gate, non-disclosure, races, accepted risks
- `docs/agents/architecture/frontend.md` — pending state and admin review UI
- `docs/agents/environment-variables.md` — verify the flag row, add the link
