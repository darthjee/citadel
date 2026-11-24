# Organizations - Tables

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Models](./models.md), [Migrations](./migrations.md), [Glossary](./glossary.md).

## Summary

Two physical tables, both in the `auth` module, both created by a single migration:

| Table | Entity | Rows |
|---|---|---|
| `auth_organizations` | `Organization` | The organizations themselves |
| `auth_organization_memberships` | `OrganizationMembership` | The join between users and organizations, carrying the role |

The `auth_` prefix is the module's convention. The original spec named them `organizations` and
`organization_memberships`; the implementation prefixes both (see
[Differences from the original spec](#differences-from-the-original-spec)).

## `auth_organizations`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | int | no | auto-increment | Primary key |
| `name` | varchar(255) | no | - | Trimmed, required, **not unique**, never logged |
| `created_at` | timestamp | no | insert time | |
| `updated_at` | timestamp | no | insert time | Updated on every write |

### Indexes

| Index | Columns | Kind | Purpose |
|---|---|---|---|
| `PRIMARY` | `id` | primary key | Row identity |

That is the complete index inventory. There is **no** index on `name`, because `name` is not
unique and is never used as a lookup key: organizations are read by `id` or listed through the
membership join.

### What this table does not have

- **No owner column** - no `owner_id`, no `creator_id`, no `created_by`. Ownership lives only in
  the membership role.
- **No `slug`** - the name is not unique, so there is nothing to disambiguate.
- **No `description`, `logo`, `status`, or `is_personal` flag** - "Personal" is a context label,
  not a row in this table.

## `auth_organization_memberships`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | int | no | auto-increment | Primary key |
| `organization_id` | int | no | - | FK -> `auth_organizations.id`, `ON DELETE RESTRICT` |
| `user_id` | int | no | - | FK -> `auth_users.id`, `ON DELETE RESTRICT`, indexed |
| `role` | varchar(16) | no | - | One of `owner`, `admin`, `user` |
| `created_at` | timestamp | no | insert time | |
| `updated_at` | timestamp | no | insert time | Updated on every write |

### Indexes

| Index | Columns | Kind | Purpose |
|---|---|---|---|
| `PRIMARY` | `id` | primary key | Row identity |
| unique | `(organization_id, user_id)` | unique | One membership per user per organization. **Also serves the membership lookup** |
| non-unique | `user_id` | index | Listed explicitly in the docs: `user_id` is indexed |

- The **unique composite index is the only lookup path** `findRole(userId, orgId)` needs, so
  `ORGANIZATION_MEMBERSHIP_LOOKUP` performs one lookup with no extra index.
- There is **no** partial unique index such as `UNIQUE (organization_id) WHERE role = 'owner'`.
  The "exactly one owner" rule is enforced by code, not by the database. See
  [Models](./models.md) and [Service](./service.md).

### The `role` column

| Value | Rank | Meaning |
|---|---|---|
| `user` | 1 | Read everything; everyday writes |
| `admin` | 2 | Everything `user` may, plus destructive and structural writes |
| `owner` | 3 | Everything `admin` may; the organization's creator |

- `varchar(16)` is wide enough for the longest value (`owner`, 5 characters) with room to spare.
- The set of allowed values is **not** a database enum. It is constrained by the application, and
  `role` is never accepted from input.

## Foreign keys

Both references on `auth_organization_memberships` are **real, database-enforced foreign keys**,
because the referenced tables also belong to `auth`:

| From | To | On delete |
|---|---|---|
| `auth_organization_memberships.organization_id` | `auth_organizations.id` | `RESTRICT` |
| `auth_organization_memberships.user_id` | `auth_users.id` | `RESTRICT` |

This is the opposite of the owner references used by user-or-organization-owned modules such as
`bank`, which cross module boundaries and are therefore **logical** only - not database
constraints.

### What `ON DELETE RESTRICT` means here

- An organization that still has memberships **cannot be deleted**. Since every organization
  always has at least its `owner` membership, no organization can be deleted at all while
  memberships exist.
- A user who still belongs to any organization **cannot be deleted**.
- Closing (deleting) an organization is documented target behaviour, not built behaviour: see
  [#83](https://github.com/darthjee/ward/issues/83). Whatever that work does, it must remove or
  otherwise resolve the memberships before the organization row can go.

## Referential shape

```
auth_users                    auth_organizations
   id (PK)                        id (PK)
      ^                              ^
      | ON DELETE RESTRICT            | ON DELETE RESTRICT
      |                              |
auth_organization_memberships
   id                (PK)
   organization_id   (FK -> auth_organizations)
   user_id           (FK -> auth_users)
   role              owner | admin | user
   created_at, updated_at

   UNIQUE (organization_id, user_id)
   INDEX  (user_id)
```

- A user has many memberships; **zero memberships is the normal state**.
- An organization has many memberships; today it has **exactly one**, because there is no way to
  join.
- There is no cascade anywhere in this pair of tables.

## Reconstructed DDL

**This block is a reconstruction from the documented schema, not a transcription of the migration
file.** The docs state the columns, types, nullability, foreign keys and indexes above; they do
not quote the DDL. Treat the block as a readable summary of the documented schema, and read the
migration itself for the authoritative version.

```sql
CREATE TABLE auth_organizations (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255)  NOT NULL,
  created_at  TIMESTAMP     NOT NULL,
  updated_at  TIMESTAMP     NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE auth_organization_memberships (
  id               INT         NOT NULL AUTO_INCREMENT,
  organization_id  INT         NOT NULL,
  user_id          INT         NOT NULL,
  role             VARCHAR(16) NOT NULL,
  created_at       TIMESTAMP   NOT NULL,
  updated_at       TIMESTAMP   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_membership_org_user (organization_id, user_id),
  KEY idx_membership_user (user_id),
  CONSTRAINT fk_membership_organization
    FOREIGN KEY (organization_id) REFERENCES auth_organizations (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_membership_user
    FOREIGN KEY (user_id) REFERENCES auth_users (id)
    ON DELETE RESTRICT
);
```

The index and constraint names above are placeholders: the docs describe the indexes by their
columns, not by name.

## Table naming and the module prefix

- Both tables use the `auth_` prefix, following the module's convention.
- The entities keep the unprefixed names (`Organization`, `OrganizationMembership`); the prefix
  is a table-level convention only.
- Because both tables live in `auth`, the foreign keys between them are real. This is the
  dividing line between real FKs (same module) and logical references (cross module).

## Differences from the original spec

| Item | Spec said | Implementation uses |
|---|---|---|
| Organization table | `organizations` | `auth_organizations` |
| Membership table | `organization_memberships` | `auth_organization_memberships` |
| Foreign key delete behaviour | not specified | `ON DELETE RESTRICT` on both FKs |

## Related physical objects

| Object | Where | Purpose |
|---|---|---|
| Migration `20261107120015-auth-create-organizations.ts` | `backend/src/database/migrations/` | Creates both tables, the FKs and the indexes. See [Migrations](./migrations.md) |
| `auth_users` | `auth` module | Referenced by `user_id`; not created or altered by this migration |

## Not documented in the repository

The `docs/agents/` pages describe the columns, types, foreign keys, indexes and rules above, but
they do **not** contain the migration's DDL, the engine/charset/collation options, the exact
index and constraint names, or the timestamp precision. Those live in the migration file and in
the TypeORM configuration. Nothing on this page is invented beyond what the docs state; the DDL
block is explicitly labelled as a reconstruction.
