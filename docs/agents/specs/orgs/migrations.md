# Organizations - Migrations

Hub: [Organizations](README.md).

## Summary

The whole feature is created by **one migration**:

| Property | Value |
|---|---|
| File | `backend/src/database/migrations/20261107120015-auth-create-organizations.ts` |
| Tables created | `auth_organizations`, `auth_organization_memberships` |
| Runs after | `20260824120001-auth-create-users.ts` |
| Position in the set | 15th |

There is no second migration for this feature. Everything the domain needs - both tables, both
foreign keys, both indexes - is in this one file.

## Why the timestamp matters

`20261107120015` is an **ordering key**, not a deployment date. It reads 7 November 2026, 12:00:15.

The only ordering constraint: it must sort **after** the users migration. The membership table has a
foreign key to `auth_users`, so creating it earlier fails.

If the target repository has its own migration numbering, place this one at the end. The number only
needs to sort after `auth_users`.

## What it creates

### `auth_organizations`

| Column | Type | Null | Key |
|---|---|---|---|
| `id` | integer | no | Primary key, auto-increment |
| `name` | varchar(255) | no | - |
| `created_at` | timestamp | no | - |
| `updated_at` | timestamp | no | - |

No index on `name`. No unique constraint. No owner column.

### `auth_organization_memberships`

| Column | Type | Null | Key |
|---|---|---|---|
| `id` | integer | no | Primary key, auto-increment |
| `organization_id` | integer | no | FK > `auth_organizations.id`, `ON DELETE RESTRICT` |
| `user_id` | integer | no | FK > `auth_users.id`, `ON DELETE RESTRICT` |
| `role` | enum or varchar | no | - |
| `created_at` | timestamp | no | - |
| `updated_at` | timestamp | no | - |

### Indexes

| Index | Columns | Kind |
|---|---|---|
| PRIMARY | `id` | Primary key |
| unique | `(organization_id, user_id)` | Unique composite |
| secondary | `user_id` | Index |

The composite unique index is what makes "one membership per user per organization" a database
rule. The `user_id` index serves `GET /orgs.json`.

There is **no index on `role`** and **no partial unique index on `role = 'owner'`**. See
[Models](./models.md).

## `up()` in order

Reproduce this sequence exactly if the target uses another migration framework:

1. Create `auth_organizations`.
2. Create `auth_organization_memberships`.
3. Create the unique index `(organization_id, user_id)`.
4. Create the index on `user_id`.
5. Create the foreign key on `organization_id` > `auth_organizations.id`.
6. Create the foreign key on `user_id` > `auth_users.id`.

Both foreign keys come last because they need the referenced tables to exist.

## `down()` in reverse

1. Drop the foreign key on `user_id`.
2. Drop the foreign key on `organization_id`.
3. Drop the indexes on `auth_organization_memberships`.
4. Drop `auth_organization_memberships`.
5. Drop `auth_organizations`.

`auth_organization_memberships` **must** be dropped before `auth_organizations`. Dropping the
referenced table first fails while the foreign key still points at it.

## The prerequisite

The migration creates a foreign key to **`auth_users`**, a table it does **not** create.

| Situation | What to do |
|---|---|
| The target already has a users table | Copy only the organizations migration; adjust the referenced table name if it differs |
| The target does not | Copy `20260824120001-auth-create-users.ts` as well |

Failure mode if skipped: the backend compiles, the server boots, and the migration throws on the
foreign key. It looks like a bug in the organizations migration and is not.

## What it must not do

- **Not create, alter or seed `auth_users`.** That belongs to the users migration.
- **Not insert data.** Organizations are created at runtime through `POST /orgs.json`.
- **Not add an `owner` column.** Ownership is the membership role.
- **Not backfill.** An earlier spec proposed auto-creating an organization at registration; it was
  reversed before being built, so there is no data to migrate.

## `ON DELETE RESTRICT` at migration time

| Situation | Behaviour |
|---|---|
| Forward run | No issue - tables are empty |
| Rollback with data | Dropping the table removes its rows too; `RESTRICT` never fires |
| Deleting an organization **row** at runtime | Blocked while a membership references it |
| Deleting a user **row** at runtime | Blocked while that user belongs to any organization |

`RESTRICT` protects against deleting **rows**, not against dropping the table that holds them. Every
organization always has at least its `owner` membership, so no organization row is deletable today.

## Running it

Migrations run through Docker Compose, never with a host-installed package manager:

```
make setup
```

Database engine: **MySQL 9.3**.

## Verification

```
SHOW CREATE TABLE auth_organizations;
SHOW CREATE TABLE auth_organization_memberships;
SHOW INDEX FROM auth_organization_memberships;
```

Confirm four things:

1. Both tables exist with the columns above.
2. The composite unique index `(organization_id, user_id)` is present.
3. The `user_id` index exists **separately** from the composite.
4. Both foreign keys carry `ON DELETE RESTRICT`.

If the composite unique index is missing, duplicate memberships become possible and `findMembership`
lookups turn ambiguous.

## What is not documented in the repository

The project documentation names the file, its position and the objects it creates. It does **not**
contain:

- the **source** of `up()` / `down()` - the DDL is not quoted anywhere;
- whether the class-based or the raw-SQL form is used;
- the exact types for `role`, `created_at` and `updated_at`;
- whether the composite unique index is declared in the migration or through an entity decorator;
- whether `helpers.ts` provides a helper this migration calls, and which;
- the storage engine, charset and collation;
- whether the migration is transactional on MySQL for DDL.

Read the migration file for the authoritative version. Nothing on this page is inferred beyond what
the docs state.
