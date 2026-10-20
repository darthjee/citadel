# Route reference

Fold `api/auth.md`, `api/admin.md` and `errors.md` into the per-endpoint docs.

- `backend/routes/auth.md`: per endpoint, the status-aware behavior and error codes as
  implemented (login, register, status, refresh, recover/reset, device poll); "Shared behavior"
  gets the identical `401 Invalid or expired access token` body from the gate and the new error
  codes.
- New `backend/routes/admin.md`, in the same per-endpoint shape as `routes/auth.md`: `search.json`
  (with the `status` filter and `currentUserId`), `recovery-link.json`, `send-recovery-email.json`,
  approve and deny (`422 USER_NOT_PENDING`, self-deny refusal, deny revokes sessions with
  `admin_denied`), plus cache policy and source files.
- `backend/routes.md`: list Admin next to Auth.

## Files to Change
- `docs/agents/backend/routes/auth.md` — status-aware endpoints, error codes
- `docs/agents/backend/routes/admin.md` — new admin route reference
- `docs/agents/backend/routes.md` — add the Admin entry
