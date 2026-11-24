# Organizations - Models

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Glossary](./glossary.md), [Tables](./tables.md), [Migrations](./migrations.md),
[Service](./service.md).

## Summary

There are **two entities**, both in the `auth` module:

- **`Organization`** - `backend/src/auth/entities/organization.entity.ts`
- **`OrganizationMembership`** - `backend/src/auth/entities/organization-membership.entity.ts`

There is no third entity. There is no `OrganizationOwner`, no `OrganizationInvite`, no
`OrganizationSettings`.

## `Organization`

Table: `auth_organizations`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | int | yes | Primary key |
| `name` | varchar(255) | yes | Trimmed on write. **Not unique** - two organizations may share a name. Never logged |
| `created_at` | timestamp | yes | Set on insert |
| `updated_at` | timestamp | yes | Updated on every write |

### What is deliberately absent

**There is no owner column.** Ownership lives only in the membership role. Do not add an
`owner_id`, a `creator_id` or a `created_by`: the absence is a design decision, not an omission.
See *owner as owner, never creator* in the [Glossary](./glossary.md).

There is also no `slug`, no `description`, no `logo`, no `status` and no `is_personal` flag.
"Personal" is a **context label**, not an organization and not a flag on this row.

### Name rules

- Trimmed before validation and storage.
- Must be non-empty after trimming.
- At most **255 code points** - counted in code points, not UTF-16 units.
- No control characters (Unicode category `Cc`). Any other Unicode is allowed.
- Always rendered escaped (React text, never HTML).

## `OrganizationMembership`

Table: `auth_organization_memberships`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | int | yes | Primary key |
| `organization_id` | int | yes | Foreign key to `auth_organizations`, `ON DELETE RESTRICT` |
| `user_id` | int | yes | Foreign key to `auth_users`, `ON DELETE RESTRICT`; indexed |
| `role` | varchar(16) | yes | One of `owner`, `admin`, `user`. Enforced per action |
| `created_at` | timestamp | yes | Set on insert |
| `updated_at` | timestamp | yes | Updated on every write |

### Constraints at the model level

- **Unique index `(organization_id, user_id)`** - one membership per user per organization. The
  same index also serves the membership lookup, so `findRole` needs no second index.
- Both foreign keys are **real** FKs (database-enforced), because `auth_organizations`,
  `auth_organization_memberships` and `auth_users` all belong to `auth`. This is the opposite of
  the owner references in user-or-organization-owned modules, which cross module boundaries and
  are therefore **logical** only.

### The `role` field

- Set **when the membership is written**, and the creator always gets `owner`.
- **Never taken from input.** `OrganizationNameDto` accepts only `name`; any other field,
  `role` included, answers `400 VALIDATION_FAILED`.
- **Re-read from the database on every request**, with no caching and no bypass.
- Valid values: `owner`, `admin`, `user`. Ranked `user` < `admin` < `owner`; a role allows
  everything a lower role allows. The type is `OrgRole` in `backend/src/core/org-role.ts`, and
  `auth` re-exports it as `MembershipRole`.

## Relations

```
auth_users                           auth_organizations
    | 1                                    | 1
    |                                      |
    | n                                    | n
    +----------< auth_organization_memberships >----------+
                     id
                     organization_id  -> auth_organizations (ON DELETE RESTRICT)
                     user_id          -> auth_users         (ON DELETE RESTRICT)
                     role             (owner | admin | user)
                     created_at, updated_at
```

- A **user** has many memberships; a user with zero memberships is the normal state.
- An **organization** has many memberships. Today it has exactly **one**, because there is no
  way to join.
- `Organization` does **not** declare an inverse `owner` relation: knowing the owner means
  querying the membership with `role = 'owner'`.

## The "exactly one owner" invariant

An organization has exactly **one** `owner` membership at all times.

This is **not a database constraint**. There is no partial unique index such as
`UNIQUE (organization_id) WHERE role = 'owner'`. The invariant holds because:

- `OrganizationService#create` is the **only** code that writes memberships;
- it writes exactly one `owner` row;
- it does so in the **same DB transaction** as the organization insert.

Any new code path that creates or updates memberships must preserve that invariant by itself.
See [Service](./service.md).

## Membership lifecycle today

| Operation | Exists | Who |
|---|---|---|
| Insert `owner` membership | yes | `OrganizationService#create`, atomically with the organization |
| Read a membership / role | yes | `findRole(userId, orgId)` and `findMembership(userId, orgId)` |
| Change a role | **no** | Target behaviour, part of the deferred member-management work (#82) |
| Remove a membership (leave) | **no** | Target behaviour (#82) |
| Transfer ownership | **no** | Target behaviour (#82) |

Registration touches only `auth_users`: no organization and no membership are created.

## Serialization boundary

The entities are never sent to the client directly. Organization routes return a **minimal
shape** built by `backend/src/auth/organization-response.ts`:

```
{ id, name, role, created_at, updated_at }
```

- `role` is the **caller's** role in that organization, not the owner's role.
- Member lists and other users' ids are never exposed.
- `OrganizationMembership` is never serialized to the public API.

See [Response](./response.md).

## Cross-module ownership - not modelled here

Modules such as `bank` support organization ownership without adding an entity here:

- an owner-root record stores two nullable, indexed, **logical** references, `user_id` and
  `organization_id`, with a DB check constraint that exactly one is set;
- the organization reference is logical because `bank` and `auth` are separate modules;
- child records inherit the owner through their root and never store a copy.

`Organization` stays a plain `{ id, name, timestamps }` record. Knowing which records belong to an
organization is the domain module's concern, never a column on this entity.

## Not documented in the repository

The `docs/agents/` pages specify the columns, types, constraints and rules above, but do **not**
transcribe the TypeScript source of the entity classes: the exact ORM decorators, property
declarations, relation decorators, index declarations and any `@Column` options are not quoted in
the documentation. Read the two entity files directly for that level of detail. Nothing on this
page is inferred beyond what the docs state.
