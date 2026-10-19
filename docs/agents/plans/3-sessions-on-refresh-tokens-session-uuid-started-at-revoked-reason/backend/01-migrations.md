# Migrations and migration specs

Add three migrations after `20260914120010`, in this order. Match the existing style: `TABLE_NAME`
const, JSDoc explaining why, class named `<Name><timestamp>`. Each migration does the following:

1. `20261018120011-auth-add-refresh-tokens-session.ts` (`AuthAddRefreshTokensSession20261018120011`)
   - `up`:
     - `addColumns` for `session_uuid varchar(36)` and `started_at datetime`, both **nullable**;
     - `query("UPDATE auth_refresh_tokens SET session_uuid = UUID(), started_at = issued_at")`;
     - `changeColumn` both to `isNullable: false`;
     - `createIndex` `idx_auth_refresh_tokens_session_uuid` (non-unique).
   - `down`: drop the index, then both columns.
2. `20261018120012-auth-add-refresh-tokens-revoked-reason.ts` (`AuthAddRefreshTokensRevokedReason20261018120012`)
   - `up`:
     - `addColumn` `revoked_reason varchar(32)` nullable;
     - `query("UPDATE auth_refresh_tokens SET revoked_reason = 'rotated' WHERE revoked_at IS NOT NULL")`.
   - `down`: `dropColumn`.
3. `20261018120013-auth-drop-sessions.ts` (`AuthDropSessions20261018120013`)
   - `up`: `dropTable('auth_sessions', true)`.
   - `down`: recreate the **empty** table exactly as `20260824120003-auth-create-sessions.ts` does
     (`idColumn()`, `user_id int`, `createdAtColumn()`, `last_seen_at datetime default
     CURRENT_TIMESTAMP`, plus index `idx_auth_sessions_user_id`).

Create `backend/src/database/tests/` with one spec per migration. Each spec uses a
`fakeQueryRunner()` of `jest.fn()` mocks and asserts the calls, their order (nullable add →
backfill → not-null → index) and the exact SQL, for both `up` and `down`. Make sure the Jest config
already picks up `src/**/*.spec.ts`. If it doesn't, extend it.

## Files to Change

- `backend/src/database/migrations/20261018120011-auth-add-refresh-tokens-session.ts`: new.
- `backend/src/database/migrations/20261018120012-auth-add-refresh-tokens-revoked-reason.ts`: new.
- `backend/src/database/migrations/20261018120013-auth-drop-sessions.ts`: new.
- `backend/src/database/tests/auth-add-refresh-tokens-session-migration.spec.ts`: new.
- `backend/src/database/tests/auth-add-refresh-tokens-revoked-reason-migration.spec.ts`: new.
- `backend/src/database/tests/auth-drop-sessions-migration.spec.ts`: new.
