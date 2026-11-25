# Organizations - Models

Hub: [Organizations](README.md).

## Summary

The domain has **two entities and no third one**:

| Entity | Table | Holds |
|---|---|---|
| `Organization` | `auth_organizations` | The organization itself: a name and timestamps |
| `OrganizationMembership` | `auth_organization_memberships` | The join between a user and an organization, **and the role** |

That is the whole model. There is no `OrganizationOwner`, `OrganizationInvite`,
`OrganizationSettings`, invitation table or audit table. Ownership and role both live in the
membership; the organization row carries neither.

## `Organization`

### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Primary key, auto-increment |
| `name` | string, 255 | Trimmed before storage; validated on write; **not unique** |
| `created_at` | timestamp | Set on insert |
| `updated_at` | timestamp | Updated on every write |

Four fields. Nothing else.

### What is deliberately absent

| Absent | Why |
|---|---|
| **`owner_id` / `ownerId`** | Ownership is the membership role. A column would duplicate the source of truth and could disagree with it |
| **`created_by`** | The creator is not recorded. This is the #95 gap - see [Roadmap](./roadmap.md) |
| **`slug`** | There is no URL-friendly identifier. Routes address the organization by `id` |
| **`description`** | Not part of the model. The only free-text field in the domain is `name` |
| **`status` / `archived_at`** | There is no soft delete and no lifecycle column. Closing an organization is not built |
| **`settings` / configuration** | No settings entity and no JSON column |
| **`member_count`** | Not stored. There is no count to denormalize because there is no member list to show |
| **`is_personal`** | "Personal" is a context label, not a flag. There is no personal organization |

The absence of `owner_id` is the single most important entry in that table: it is why the "exactly
one owner" rule can only be enforced by the service, and why the organization row cannot contradict
the membership.

### Constraints on `name`

| Rule | Detail |
|---|---|
| Trimmed | Leading and trailing whitespace removed before validation and storage |
| Required | Empty or whitespace-only after trimming is rejected |
| Maximum length | **255 code points** - not UTF-16 units |
| Control characters | Rejected - Unicode category `Cc` |
| Other Unicode | Allowed - accented letters, emoji, CJK are all valid |
| Uniqueness | **None.** Two organizations may share a name, including two organizations of the same user |

The code-point rule matters for characters outside the Basic Multilingual Plane: an emoji is **two**
UTF-16 units but **one** code point. A validation written against `name.length` would reject a valid
name.

## `OrganizationMembership`

### Fields

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Primary key, auto-increment |
| `organization_id` | integer | Foreign key to `auth_organizations.id`, `ON DELETE RESTRICT` |
| `user_id` | integer | Foreign key to `auth_users.id`, `ON DELETE RESTRICT` |
| `role` | enum or string | One of `owner`, `admin`, `user` |
| `created_at` | timestamp | Set on insert |
| `updated_at` | timestamp | Updated on write |

### Uniqueness

The pair **`(organization_id, user_id)` is unique**. One membership per user per organization - a
user cannot hold two roles in the same organization.

There is **no** constraint limiting how many `owner` rows an organization has. The
"exactly one owner" rule is not a partial unique index; it is a property of the code.

### Relations

| Direction | Relation |
|---|---|
| `membership.organization` | Many-to-one to `Organization` |
| `membership.user` | Many-to-one to `User` |
| `organization.memberships` | One-to-many - exists as a relation, but **never serialized** |

The `organization.memberships` relation is the one that must not reach a response. Loading it is
harmless; putting it in a DTO turns four routes into an enumeration surface. See
[Response](./response.md).

## The role

| Value | Rank | Meaning |
|---|---|---|
| `owner` | 3 | The organization's creator. Everything `admin` can do |
| `admin` | 2 | Destructive and structural writes |
| `user` | 1 | Reads, and everyday writes |

The ranking is `user` < `admin` < `owner`, and a role allows everything a lower one allows. The
comparison is `hasMinRole(role, min)`.

**No action is owner-only today.** The `owner` value is the membership written by `create`; it does
not yet guard anything an `admin` cannot do. That arrives with the deferred epics - see
[Roles](./roles.md).

## Ownership: where it actually lives

The organization owns nothing *through a column*. The chain is:

```
Organization          id, name, timestamps        <- no owner field
OrganizationMembership  organization_id, user_id, role
                      ^ the only place role and membership exist
```

For a **domain record** in a user-or-organization-owned module such as `bank`, the owner is stored on
the record itself, as two nullable, indexed, **logical** references:

| Column | Points at | Notes |
|---|---|---|
| `user_id` | `auth_users.id` | Set when the record is personal. **Logical reference - no FK** |
| `organization_id` | `auth_organizations.id` | Set when the record belongs to an organization. **Logical reference - no FK** |

A database check constraint requires **exactly one** of them to be set. Neither is a foreign key,
because those modules are deliberately separate from `auth`.

Consequence: an organization record has **`user_id` `NULL`** even though a member created it. That is
what makes a personal query structurally unable to return it.

## The two-entity rule, and its one violation

The model says two entities. A domain record that belongs to an organization carries
`organization_id` - which references a third table, `auth_organizations`, **without a foreign key**.

So the strict statement is:

- **The organizations domain** has two entities.
- **Modules that use organizations** add a column, never a new organization-related entity.
- **No module has an `OrganizationOwner`-style table.** Ownership is never denormalized.

## Invariants

The properties a change to these models must preserve.

| Invariant | Held by |
|---|---|
| Exactly one `owner` per organization | `OrganizationService#create` being the only membership writer - **not** a database constraint |
| One membership per user per organization | The unique index `(organization_id, user_id)` |
| An organization always has at least one membership | Creation writes the organization and the `owner` membership in one transaction |
| The role is never defaulted from input | The role is hard-coded to `owner` at creation; no other writer exists |
| A record has exactly one owner | The check constraint on `user_id` / `organization_id` in owner-root tables |
| Personal and organization data never mix | `user_id` `NULL` on organization records |

### Why "exactly one owner" is the fragile one

Every other invariant in that table is enforced by the database. This one is not.

There is no partial unique index on `role = 'owner'`. It holds today for a single reason: `create`
is the only code path that writes a membership, and it always writes exactly one `owner`. Any change
that introduces a second writer - invite, join, transfer, role change - must preserve it in its own
transaction, and nothing in the schema will catch a mistake.

See [Service](./service.md) and [Roadmap](./roadmap.md).

## Relationship to `User`

`OrganizationMembership.user_id` is a foreign key to `auth_users.id` with `ON DELETE RESTRICT`.

- A user **cannot be deleted** while any membership references them.
- A **denied** or suspended user keeps their memberships. Nothing removes them, because removing a
  member is not built.
- Organization data created by that user **belongs to the organization**, not to the user, and
  outlives their access.
- `User.isAdmin` is a **platform** flag and is not part of these models. It grants no organization
  access.

## What is not documented in the repository

The project documentation states the two entities, their tables, the field set, the unique pair, the
foreign keys and the `name` rules. It does **not** contain:

- the **exact TypeScript declaration** of either entity - column decorators, nullability annotations,
  relation options and enum versus string for `role`;
- whether `role` is a database enum type or a `varchar` with a check;
- the **length** declared on `role`;
- whether `Organization` declares a relation to memberships at all, though it is implied by "never
  serialize the memberships";
- the exact generated column names in MySQL beyond the snake_case forms listed here;
- whether the check constraint on owner-root tables is expressed at table level or as a trigger.

Read `backend/src/auth/entities/organization.entity.ts` and
`backend/src/auth/entities/organization-membership.entity.ts` for the authoritative version. Nothing
on this page is inferred beyond what the docs state.
