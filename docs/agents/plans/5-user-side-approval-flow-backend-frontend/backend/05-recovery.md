# Recover and reset password

Per [api/auth.md → recover / reset](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/api/auth.md#post-authrecoverjson-and-post-authreset-passwordjson)
and [security.md → Non-disclosure](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/security.md#non-disclosure).

`auth/password-reset.service.ts`:

- `recover`: a denied user is treated exactly like an unknown email — same `not found` log line,
  no token, no `password-recovery.requested` event. Approved and pending unchanged.
- `resetPassword`: right after `#findActiveToken` and **before** `bcrypt.hash`, load the user;
  denied (or missing) → the same `BadRequestException('Invalid or expired token')`, token **not**
  consumed, password unchanged. Pending resets normally and stays pending (`AuthService` still
  revokes with `password_reset`).
- `issueToken` (admin recovery tools) unchanged.

Tests (`password-reset.service.spec.ts`, `auth.controller.recovery.e2e-spec.ts`):

- `recover.json` for denied vs unknown vs approved email → identical `200 { sent: true }`; no
  token row and no event for denied.
- `reset-password.json` with a denied user's valid token → `400 Invalid or expired token`,
  password unchanged, token still unused, `bcrypt.hash` never called (spy).
- `reset-password.json` with a pending user's token → password changed, status still `pending`.

## Files to Change

- `backend/src/auth/password-reset.service.ts` — denied checks.
- `backend/src/auth/tests/password-reset.service.spec.ts` — unit cases.
- `backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts` — e2e cases.
