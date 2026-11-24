# Organizations - Migrations

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Tables](./tables.md), [Models](./models.md), [Glossary](./glossary.md).

## Summary

The two organization tables are created by **exactly one migration**:

| Property | Value |
|---|---|
| File | `20261107120015-auth-create-organizations.ts` |
| Folder | `backend/src/database/migrations/` |
| Creates | `auth_organizations` and `auth_organization_memberships` |
| Also creates | The two foreign keys, the unique index `(organization_id, user_id)` and the `user_id` index |
| Touches | Nothing else. `auth_users` is referenced, never altered |

## Scope of this page

The `docs/agents/` pages name this migration and state what it creates. They do **not** quote its
source: the exact `up()` and `down()` bodies, the `QueryRunner` calls, the index and constraint
names, and the engine/charset/collation options are not in the documentation.

This page therefore documents:

- **what is documented** - the file, its folder, and the objects it creates;
- **what follows from the schema** - creation order, why the FKs must come last, what `down()`
  must do;
- **what is not documented** - everything about the source itself.

Read the migration file for the authoritative version. Nothing on this page claims to be a
transcription of it.

## File naming convention

The filename follows TypeORM's migration convention, `<timestamp>-<name>.ts`:

```
20261107120015-auth-create-organizations.ts
|------------| |--------------------------|
     |                    |
     |                    +-- descriptive name: module + action + subject
     +-- timestamp in YYYYMMDDHHMMSS form
```

- `2026 11 07 12 00 15` decodes to **7 November 2026, 12:00:15**. This is the migration ordering
  key, not a deployment date: it fixes the position of the file in the run order.
- `auth` is the module prefix, matching `backend/src/auth/`.
- `create-organizations` states the action and the subject, in kebab-case.
- TypeScript, per the project stack (Node.js, ES Modules, TypeScript strict, TypeORM with CLI
  migrations).

Migrations live under `backend/src/database/migrations/` - a single shared folder for all modules,
not inside each module's own directory. This is the convention stated in `AGENTS.md`.

## What the migration creates

### Tables

| Table | Purpose |
|---|---|
| `auth_organizations` | The organizations: `id`, `name`, `created_at`, `updated_at` |
| `auth_organization_memberships` | The join between users and organizations, carrying the role |

### Constraints and indexes

| Object | Table | Detail |
|---|---|---|
| Primary key | `auth_organizations` | `id` |
| Primary key | `auth_organization_memberships` | `id` |
| Unique index | `auth_organization_memberships` | `(organization_id, user_id)` - one membership per user per organization; also serves the membership lookup |
| Index | `auth_organization_memberships` | `user_id` |
| Foreign key | `auth_organization_memberships` | `organization_id` -> `auth_organizations.id`, `ON DELETE RESTRICT` |
| Foreign key | `auth_organization_memberships` | `user_id` -> `auth_users.id`, `ON DELETE RESTRICT` |

There is **no** unique index on `auth_organizations.name` and **no** partial unique index on
`role = 'owner'`. See [Tables](./tables.md).

## Creation order, and why

A correct `up()` must respect the dependency chain. The order below **follows from the
documented schema** - it is inference from the foreign keys, not a transcription of the
migration:

1. **`auth_organizations`** - referenced by the other table, so it must exist first.
2. **`auth_organization_memberships`** - the referencing table.
3. **Unique index `(organization_id, user_id)`** - needs the table and both columns.
4. **Index on `user_id`** - needs the table and the column.
5. **Foreign key on `organization_id`** - needs both tables to exist.
6. **Foreign key on `user_id`** - needs `auth_users` to exist.

### The hard dependency

The second foreign key points at **`auth_users`**, which this migration does **not** create. That
makes the users migration a **prerequisite**: the organizations migration can only run after
`auth_users` exists. This is the one ordering constraint that a reader must not miss, and it is
the reason the organizations migration carries a later timestamp than the users one.

### What the migration must not do

- It must not create, alter or seed `auth_users`.
- It must not insert data. Organizations are created at runtime through `POST /orgs.json`, and
  registration creates none. The first spec (#28) would have auto-created an organization at
  registration; #40 reversed that **before it was built**, so no data migration exists for it.
- It must not create an `owner` column anywhere. Ownership lives in the membership role.

## `down()`

The schema dictates what a rollback needs, in reverse dependency order:

1. Drop the two foreign keys.
2. Drop the indexes on `auth_organization_memberships`.
3. Drop `auth_organization_memberships`.
4. Drop `auth_organizations`.

Because both foreign keys are `ON DELETE RESTRICT`, the referencing table must be dropped before
the referenced one - the reverse of the creation order. Dropping `auth_organizations` first would
fail while the foreign key still points at it.

The exact implementation is **not documented**, so whether `down()` drops the indexes explicitly
or relies on the table drop is unknown from the docs. Follow the file.

## Interacting with `ON DELETE RESTRICT` at migration time

- **Forward run** - no issue: the tables are empty, so there is nothing to restrict.
- **Rollback with data** - dropping the tables removes the rows too, so `RESTRICT` never fires
  during a table drop. `RESTRICT` protects against deleting *rows*, not against dropping the
  table that holds them.
- **Deleting an organization row at runtime** - blocked while a membership references it. Since
  every organization always has at least its `owner` membership, no organization row is
  deletable today. See [Tables](./tables.md).
- **Deleting a user row at runtime** - blocked while that user still belongs to any organization.

Closing (deleting) organizations is documented target behaviour, not built: see
[#83](https://github.com/darthjee/ward/issues/83). Whatever that work does, it must remove or
otherwise resolve the memberships before the organization row can go.

## Running migrations

Per `AGENTS.md`, migrations run through Docker Compose - never with a host-installed package
manager:

```
make setup
```

All project commands go through `docker-compose`. The backend runs on port `3030`, the frontend
dev server on `3010`, and the full stack proxy on `3000`. Database engine: MySQL 9.3.

## Naming divergence from the original spec

| Item | Original spec | Migration creates |
|---|---|---|
| Organization table | `organizations` | `auth_organizations` |
| Membership table | `organization_memberships` | `auth_organization_memberships` |

The prefix follows the module convention: every `auth` table is `auth_`-prefixed. The entity
class names stay unprefixed (`Organization`, `OrganizationMembership`); the prefix is a
table-level decision only. This divergence is listed among the
[Differences from the original spec](./orgs.md) of the module and repeated here because the
migration is where it becomes physical.

## What is not documented in the repository

The following are **absent** from `docs/agents/` and must be read from the migration file or the
TypeORM configuration:

- the `up()` and `down()` source;
- the exact index and constraint names (the docs describe indexes by their columns, never by
  name);
- whether indexes and foreign keys are created inside the `CREATE TABLE` call or by separate
  statements;
- transaction wrapping and any `IF NOT EXISTS` guards;
- engine, charset and collation per table;
- timestamp precision and timezone handling;
- whether `created_at` / `updated_at` defaults are set in the database or by the ORM.

Nothing on this page is invented beyond what the docs state. The creation order, the `down()`
sequence and the `RESTRICT` behaviour are derived from the documented schema, and are labelled as
derived where they appear.
