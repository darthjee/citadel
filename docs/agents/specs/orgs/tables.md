# Organizations - Tables

Hub: [Organizations](README.md).

## Summary

Two tables, created by a single migration.

| Table | Rows are | Created by |
|---|---|---|
| `auth_organizations` | Organizations | `20261107120015-auth-create-organizations.ts` |
| `auth_organization_memberships` | One membership per user per organization | Same migration |

Both carry the **`auth_` prefix** because the concept lives in the `auth` module, next to the user
table. See [Migrations](./migrations.md) for the ordering and rollback.

## `auth_organizations`

| Column | Type | Null | Key |
|---|---|---|---|
| `id` | integer | no | **PK**, auto-increment |
| `name` | varchar(255) | no | - |
| `created_at` | timestamp | no | - |
| `updated_at` | timestamp | no | - |

### Indexes

| Index | Columns | Kind |
|---|---|---|
| `PRIMARY` | `id` | Primary key |

**No index on `name`.** Not unique, not indexed. Two organizations may share a name, and there is no
lookup by name anywhere in the API - the list route returns the caller's memberships ordered by `id`.

### Constraints

| Constraint | Detail |
|---|---|
| Primary key | `id` |
| No unique constraint on `name` | Deliberate - see [Models](./models.md) |
| No foreign keys out | The row references nothing |

## `auth_organization_memberships`

| Column | Type | Null | Key |
|---|---|---|---|
| `id` | integer | no | **PK**, auto-increment |
| `organization_id` | integer | no | **FK** > `auth_organizations.id`, `ON DELETE RESTRICT` |
| `user_id` | integer | no | **FK** > `auth_users.id`, `ON DELETE RESTRICT` |
| `role` | enum or varchar | no | - |
| `created_at` | timestamp | no | - |
| `updated_at` | timestamp | no | - |

### Indexes

| Index | Columns | Kind | Purpose |
|---|---|---|---|
| `PRIMARY` | `id` | Primary key | - |
| unique | `(organization_id, user_id)` | **Unique composite** | One membership per user per organization |
| `idx` | `user_id` | Secondary | Lists a user's organizations - the query behind `GET /orgs.json` |

The composite unique index is the one that makes "one membership per user per organization" a
database rule rather than a convention.

The `user_id` index is the one `GET /orgs.json` depends on: it looks up memberships by user.

**There is no index on `role`**, and there is **no partial unique index on `role = 'owner'`**. The
"exactly one owner" rule is held by the service, not by the schema.

### Foreign keys

| Column | References | On delete | Effect |
|---|---|---|---|
| `organization_id` | `auth_organizations.id` | **RESTRICT** | An organization row cannot be deleted while a membership references it |
| `user_id` | `auth_users.id` | **RESTRICT** | A user row cannot be deleted while they belong to any organization |

Both are `RESTRICT`, not `CASCADE`. Deleting an organization does **not** delete its memberships, and
deleting a user does **not** remove their memberships.

Because every organization always has at least its `owner` membership, and removing memberships is
not built, **no organization row is deletable today**.

## The `role` column

| Property | Value |
|---|---|
| Values | `owner`, `admin`, `user` |
| Default | None. The service always writes an explicit value |
| Ranked | `user` < `admin` < `owner` |
| Read by | `hasMinRole()` for every role check |

Whether the column is a database `ENUM` or a `VARCHAR` with a check is not stated in the project
documentation. Either way, the constraint that matters is at the service level: the role is never
taken from input.

## What these tables do not have

| Absent | Consequence |
|---|---|
| `owner_id` on `auth_organizations` | Ownership cannot contradict the membership role |
| `created_by` anywhere | No authorship trail (#95) |
| `slug` on `auth_organizations` | Routes address by `id` only |
| `status` / `archived_at` | No soft delete, no lifecycle |
| `member_count` | No denormalized count to keep in sync |
| `deleted_at` | No soft delete |
| Unique on `name` | Duplicate names are legal |
| FK from any `bank` table | `bank` references `auth_organizations.id` **logically**, without a foreign key |

The last row is the one that surprises: a `bank` record can hold an `organization_id` that no longer
exists, and the database will not object. See [Owner context](./owner-context.md).

## `bank` tables - the logical reference

For a user-or-organization-owned module, the owner-root table carries two nullable columns:

| Column | Type | Null | Key |
|---|---|---|---|
| `user_id` | integer | **yes** | Logical reference to `auth_users.id` - **no FK** |
| `organization_id` | integer | **yes** | Logical reference to `auth_organizations.id` - **no FK** |

A **check constraint requires exactly one of the two to be set**. Both are indexed.

| Property | Detail |
|---|---|
| Foreign keys | **None.** The modules are deliberately separate |
| Check constraint | Exactly one of `user_id`, `organization_id` is non-null |
| Child tables | Store **no** owner copy - they inherit through their root |

Consequence for an `organization_id` pointing at a deleted or never-existing organization: nothing in
the database rejects it. The application must prevent it, which is why closing an organization (#83)
is not a simple delete.

## Query patterns these indexes serve

| Query | Uses |
|---|---|
| `GET /orgs.json` - organizations of the current user | `user_id` index, joined to `auth_organizations` |
| Membership check for `:orgId` | unique `(organization_id, user_id)` |
| Role lookup for the guard | unique `(organization_id, user_id)` |
| Ordered organization list | `id` on `auth_organizations` - the documented order |
| Search organizations by name | **No index.** No such query exists in the API |

## Verification queries

Useful when checking a replica:

```
SHOW CREATE TABLE auth_organizations;
SHOW CREATE TABLE auth_organization_memberships;
SHOW INDEX FROM auth_organization_memberships;
```

What to confirm:

1. **Both foreign keys present**, each with `ON DELETE RESTRICT`.
2. **The composite unique index** on `(organization_id, user_id)`.
3. **The `user_id` index** exists separately from the composite.
4. **No unique index on `auth_organizations.name`**.

If the composite unique index is missing, the application will allow duplicate memberships and the
`findMembership` lookups become ambiguous.

## What is not documented in the repository

The project documentation states the tables, the columns, the foreign keys, both indexes and the
`name` rules. It does **not** contain:

- the **exact DDL** of `20261107120015-auth-create-organizations.ts` - the migration file is named,
  its contents are not quoted;
- the concrete column types beyond `id`, `name` and the timestamps - `role` is documented as a set of
  three values, not as a specific SQL type;
- whether `created_at` / `updated_at` are `DATETIME` or `TIMESTAMP`, and whether either has
  `ON UPDATE CURRENT_TIMESTAMP`;
- index names as MySQL generates them;
- whether the composite unique index is declared in the migration or through an entity decorator;
- the storage engine, charset and collation;
- whether the check constraint on owner-root tables is a table-level CHECK or enforced elsewhere.

Read the migration file and `SHOW CREATE TABLE` output for the authoritative schema. The column
types above are the conservative reading of what the docs require, not a transcription of the DDL.
