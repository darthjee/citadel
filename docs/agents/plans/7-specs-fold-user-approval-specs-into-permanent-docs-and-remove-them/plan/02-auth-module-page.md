# Auth module page

Bring `modules/auth.md` up to date with `model.md`, `gate.md` and `api/*.md` as implemented.

- Route table: `status.json` response as implemented (with the user status / `pending` answer),
  and note which routes answer differently for `pending` / `denied` users, linking to
  `user-approval.md` and the route docs.
- Admin tool routes: `search.json` `{ q?, status? }` with the `status` field in each user and
  `currentUserId` in the response; new approve and deny routes; fix the stale "All three / All
  four" counts.
- Entities: refresh tokens carry `session_uuid`, `started_at`, `revoked_reason` (only `rotated`
  triggers replay detection; `admin_denied` on deny); `auth_sessions` is gone; `auth_users.status`
  with the `approved` backfill.
- JWT/refresh-token flow: a session is one chain of rotated tokens; the access token carries
  `sid`; `JwtGuard` checks the session through `SESSION_LOOKUP` (`SessionService`) on every
  non-public request, requires an active session of an `approved` user with `id === sub`, and
  builds `request.user` from the DB row; every rejection is the identical `401`.
- Admin authorization: `isAdmin` comes from the DB row on each request, so a demotion applies on
  the next request.
- Testing: mention `InMemorySessionLookup` in the test support, if the section lists test helpers.

## Files to Change
- `docs/agents/modules/auth.md` — routes, admin routes, entities, JWT flow, admin authorization
