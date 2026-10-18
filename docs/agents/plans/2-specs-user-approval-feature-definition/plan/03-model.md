# Data model

Write `docs/agents/specs/user-approval/model.md`, from §2 (refresh-token rows), §3.1 and §5.

Sections:

- **Sessions on refresh tokens** (implemented by #3): `auth_refresh_tokens.session_uuid
  varchar(36) NOT NULL` (indexed) and `started_at datetime NOT NULL`, backfilled with `UUID()` /
  `issued_at`; `revoked_reason` (`rotated`, `logout`, `admin_denied`, … — list the values Citadel
  needs, check every current `revokedAt` write in `backend/src/auth/`); fresh session on login,
  register and winning device poll; rotation copies `session_uuid` and `started_at`; replay
  detection fires only on `rotated` rows. An active session = one non-revoked, unexpired row.
- **`auth_sessions` dropped** (implemented by #3): rationale (`TokenService#touchSession` inserts a
  row on every issuance, nothing reads it), remove the `Session` entity, `touchSession` and the
  repository injection, drop migration whose `down` recreates the empty table.
- **User status** (implemented by #5): `UserStatus` const, `auth_users.status varchar(16) NOT
  NULL` with **no column default** (and why); migration nullable → backfill `approved` →
  NOT NULL, kept even though Citadel is a template; seeds (demo user migrations) set `approved`
  explicitly; status not added to the auth `user` payload.
- **Migration / deploy order**: sessions migration before the gate (#4); status migration ships
  in the same deploy as the gate's `approved` requirement (#5).
- Reference: Kerghan migrations and entities by GitHub URL (§2/§5 links).
- Required tests: migration up/down specs (backfills), rotation keeps the session, new session
  per login, replay detection only on `rotated`.

## Files to Change
- `docs/agents/specs/user-approval/model.md` — new.
