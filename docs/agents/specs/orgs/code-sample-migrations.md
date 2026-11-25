# Organizations - Code Sample - Migrations

Part 2 of 3. Index: [Code Sample](./code-sample.md).
Previous: [Backend](./code-sample-backend.md). Next: [Frontend](./code-sample-frontend.md).

**2 files.** Small on purpose, and the part most likely to break a replica.

**Status after #28:** both files are in citadel; **none remains under `code_sample/`**.

## Files

Base: `backend/src/database/migrations/`.

| File | Role |
|---|---|
| [20261107120015-auth-create-organizations.ts](../../../../backend/src/database/migrations/20261107120015-auth-create-organizations.ts) | Creates `auth_organizations` and `auth_organization_memberships`, both foreign keys, the unique index `(organization_id, user_id)` and the `user_id` index - **ported in #28** to `backend/src/database/migrations/20261107120015-auth-create-organizations.ts` (covered by `database/tests/auth-create-organizations-migration.spec.ts` and the MySQL `organization.service.integration-spec.ts`) |
| [helpers.ts](../../../../backend/src/database/migrations/helpers.ts) | Shared migration helpers - **imported by the organizations migration**. **Already in citadel, no port** (#26): the sample copy was identical and has been deleted |

`helpers.ts` is shared by the whole migration set, not only this one. Copy it as-is; if the target
repository already has its own equivalent, adapt the import in the organizations migration instead
of overwriting.

## The prerequisite you must not skip

The organizations migration creates a foreign key to **`auth_users`**, a table it does **not**
create:

```
backend/src/database/migrations/20260824120001-auth-create-users.ts
```

**That file is not part of this feature** - it belongs to the users feature and is listed here only
because the organizations migration cannot run without it. Two cases:

1. **The target repository already has an equivalent users table.** Copy only the two files above
   and adjust the table name in the foreign key if it differs.
2. **It does not.** Copy `20260824120001-auth-create-users.ts` as well, or the migration fails at
   the foreign key.

The failure mode is the confusing one: the backend compiles, the server boots, and the migration
throws on the `user_id` foreign key. It looks like a bug in the organizations migration and is not.

## Ordering

Timestamp: **`20261107120015`** - 7 November 2026, 12:00:15. It is an ordering key, not a
deployment date.

| Property | Value |
|---|---|
| Position in the set | **15th** |
| Must run after | `20260824120001-auth-create-users.ts` |
| Migrations for this feature | **1** |

The timestamp must stay **later** than the users migration. Renumbering it earlier breaks the
foreign key. If the target repository already has its own migration sequence, place this one at the
end rather than preserving the number - the number only needs to sort after `auth_users`.

## What it creates

### Tables

| Table | Columns |
|---|---|
| `auth_organizations` | `id`, `name`, `created_at`, `updated_at` |
| `auth_organization_memberships` | `id`, `organization_id`, `user_id`, `role`, `created_at`, `updated_at` |

### Constraints and indexes

| Object | Table | Detail |
|---|---|---|
| Primary key | `auth_organizations` | `id` |
| Primary key | `auth_organization_memberships` | `id` |
| Unique index | `auth_organization_memberships` | `(organization_id, user_id)` - one membership per user per organization |
| Index | `auth_organization_memberships` | `user_id` |
| Foreign key | `auth_organization_memberships` | `organization_id` > `auth_organizations.id`, `ON DELETE RESTRICT` |
| Foreign key | `auth_organization_memberships` | `user_id` > `auth_users.id`, `ON DELETE RESTRICT` |

There is **no** unique index on `auth_organizations.name`, and **no** partial unique index on
`role = 'owner'`. The "exactly one owner" rule is held by the service, not by the schema.

## `up()` in dependency order

The migration must run in this sequence. Reproduce it in this order if the target framework differs:

1. Create `auth_organizations`.
2. Create `auth_organization_memberships`.
3. Create the unique index `(organization_id, user_id)`.
4. Create the index on `user_id`.
5. Create the foreign key on `organization_id`.
6. Create the foreign key on `user_id`.

Both foreign keys come last because they need the referenced tables to exist.

## `down()` in reverse

1. Drop the two foreign keys.
2. Drop the indexes on `auth_organization_memberships`.
3. Drop `auth_organization_memberships`.
4. Drop `auth_organizations`.

`auth_organization_memberships` must be dropped **before** `auth_organizations`. Dropping the
referenced table first fails while the foreign key still points at it.

## What the migration must not do

- **It must not create, alter or seed `auth_users`.** That is the users migration's job.
- **It must not insert data.** Organizations are created at runtime through `POST /orgs.json`.
  Registration creates none - an earlier spec proposed auto-creating one at registration and was
  reversed before being built, so **no backfill migration exists**.
- **It must not add an `owner` column** to any table. Ownership lives only in the membership role.

## `ON DELETE RESTRICT` at migration time

Worth knowing before debugging a rollback:

| Situation | Behaviour |
|---|---|
| Forward run | No issue - the tables are empty |
| Rollback with data | Dropping the table removes its rows too; `RESTRICT` never fires |
| Deleting an organization **row** at runtime | Blocked while a membership references it |
| Deleting a user **row** at runtime | Blocked while that user belongs to any organization |

`RESTRICT` protects against deleting **rows**, not against dropping the table that holds them. Every
organization always has at least its `owner` membership, so no organization row is deletable today.

## Running it

Per the project conventions, migrations run through Docker Compose - never with a host-installed
package manager:

```
make setup
```

Database engine: **MySQL 9.3**.

## Verification after copying

Run these three checks before moving to part 3:

1. **The two tables exist** with the columns listed above.
2. **`SHOW INDEX` on `auth_organization_memberships`** lists the unique `(organization_id, user_id)`
   and the `user_id` index.
3. **`SHOW CREATE TABLE` shows both foreign keys with `ON DELETE RESTRICT`.**

If the foreign key on `user_id` is missing, the prerequisite of this part was skipped - see above.

## Checklist

| Item | Done |
|---|---|
| `20261107120015-auth-create-organizations.ts` | |
| `helpers.ts` | |
| `20260824120001-auth-create-users.ts` - prerequisite, only if absent in the target | |
| Migration ran clean | |
| Both foreign keys present with `RESTRICT` | |
