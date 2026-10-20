# Migration specs

Exercise migrations on the real engine. Each spec file calls `resetDatabase` in `beforeEach`.

- `migrations-round-trip.integration-spec.ts`: `runMigrations()` (all `up`), then `undoLastMigration()`
  until none remain (all `down`), then `runMigrations()` again — each phase succeeds, and after the
  full `down` no `auth_*` tables remain.
- `auth-add-refresh-tokens-session.integration-spec.ts` (#3, `…120011`): migrate up to `…120010`,
  insert a user and several refresh-token rows with distinct `issued_at`, run `…120011`:
  every row gets a non-null, **distinct** `session_uuid`; `started_at = issued_at`; both columns
  are `NOT NULL` (an insert without them fails); the `idx_auth_refresh_tokens_session_uuid` index
  exists; `down` removes both columns and the index.
- `auth-add-refresh-tokens-revoked-reason.integration-spec.ts` (#3, `…120012`): seed revoked and
  active rows before it: revoked rows get `revoked_reason = 'rotated'`, active rows stay
  `NULL`, the column is nullable; `down` drops it.
- `auth-drop-sessions.integration-spec.ts` (#3, `…120013`): `auth_sessions` is gone after `up` and
  recreated with its columns by `down`.
- `auth-add-users-status.integration-spec.ts` (#5, `…120014`): with the demo seed users present
  (whatever rows exist, without depending on the demo password) plus an extra
  inserted user, `up` backfills every row to `approved`; the column is `NOT NULL` with **no
  default** (an insert without `status` fails); `down` drops it.

Use `queryRunner.getTable()` / `INFORMATION_SCHEMA` for nullability, defaults and indexes rather
than re-deriving them from the migration code.

## Files to Change

- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts` — new.
- `backend/src/database/tests/integration/auth-add-refresh-tokens-session.integration-spec.ts` — new.
- `backend/src/database/tests/integration/auth-add-refresh-tokens-revoked-reason.integration-spec.ts` — new.
- `backend/src/database/tests/integration/auth-drop-sessions.integration-spec.ts` — new.
- `backend/src/database/tests/integration/auth-add-users-status.integration-spec.ts` — new.
