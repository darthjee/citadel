# Status model, migration, revoked reason and error code

Per [model.md → User status](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/model.md#user-status) and [errors.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/errors.md).

- `auth/entities/user.entity.ts`: export `UserStatus` (`PENDING: 'pending'`,
  `APPROVED: 'approved'`, `DENIED: 'denied'`, `as const` + type, same style as
  `RevokedReason`) and add `@Column({ type: 'varchar', length: 16 }) status!: UserStatus;` — **no
  default**.
- New migration `database/migrations/<timestamp>-auth-add-users-status.ts` (timestamp after
  `20261018120013`; next sequence `…14`): add `status varchar(16)` nullable →
  `UPDATE auth_users SET status = 'approved'` → change it to `NOT NULL` with no default. Runs in
  every environment (not `skipInProduction`); it covers the demo seed user, whose migrations run
  earlier. `down` drops the column. Doc-comment explains why there is no default.
- `auth/entities/refresh-token.entity.ts`: `RevokedReason.ADMIN_DENIED = 'admin_denied'` with a
  doc comment (written by the `status.json` / `refresh.json` re-checks here and by deny in #6).
  The column is `varchar(32)`, so no migration.
- `core/error-codes.ts`: `USER_DENIED: 'USER_DENIED'`.
- `auth/auth.service.ts`: `register` must set `status` explicitly (wired in step 02).

Tests:

- New `database/tests/auth-add-users-status-migration.spec.ts` with `fake-query-runner.ts`
  (mirroring the existing migration specs): `up` adds the column, backfills `approved`, makes it
  `NOT NULL` with no default; `down` drops it.

## Files to Change

- `backend/src/auth/entities/user.entity.ts` — `UserStatus` and the `status` column.
- `backend/src/database/migrations/<timestamp>-auth-add-users-status.ts` — new migration.
- `backend/src/database/tests/auth-add-users-status-migration.spec.ts` — new spec.
- `backend/src/auth/entities/refresh-token.entity.ts` — `ADMIN_DENIED`.
- `backend/src/core/error-codes.ts` — `USER_DENIED`.
