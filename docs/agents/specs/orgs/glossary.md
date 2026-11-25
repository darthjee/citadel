# Organizations - Glossary

Hub: [Organizations](README.md).

## Why this page exists

Most misreadings of this domain come from **two words that carry two meanings each**. This page
fixes the vocabulary first, so the other pages can be read without ambiguity.

Read this before writing about organizations, naming a variable, or reviewing a change in this area.

## The first ambiguity: "owner"

The word appears in two unrelated senses, and a sentence using both is unreadable without knowing
which is which.

| Term | Meaning | Where it lives |
|---|---|---|
| **owner** (role) | The highest of the three membership roles, `owner` | `OrganizationMembership.role` |
| **owner** (of a record) | The user or the organization a domain record belongs to | `user_id` / `organization_id` on the record |

Consequences of confusing them:

- **An organization `owner` is not the owner of the organization's records.** The records are owned
  by the organization itself, not by the person who holds the `owner` role.
- **A record's owner has no role.** `owner` as a role is a property of a membership; a record's owner
  is a pair of nullable columns.
- **An organization record has `user_id` `NULL`.** The user who created it is not its owner, even
  though they hold the `owner` role in that organization.

The codebase keeps them apart by naming: the membership role is always `role` of type `OrgRole`; the
record owner is always `ownerId` / `ownerContext`. See [Roles](./roles.md) and
[Owner context](./owner-context.md).

## The second ambiguity: "Personal"

**Personal is a context label, not an entity.**

| Wrong reading | Correct reading |
|---|---|
| "Personal" is a special organization | It is the absence of an organization |
| "Personal" is a flag on `Organization` | No such flag exists |
| "Personal" is a row in a table | There is no table |
| "Personal" is a fourth role | No - in Personal the role is `owner`, the same value |

- The **personal context** is the mode where the JWT user operates on their own data.
- The backend path is `/<module>/...` - no `/orgs/:orgId/` segment and no user id either.
- The UI path is `#/<module>/...`.
- `ownerRole(ctx)` returns **`owner`** for the personal context, which is why `can()` needs no
  personal-specific branch.

An earlier spec proposed auto-creating an organization at registration, which would have made
"Personal" a passing state rather than a permanent one. It was reversed before being built - so
**Personal is a durable context, not a bootstrap gap**.

## Core entities

| Term | Definition |
|---|---|
| **Organization** | The group entity. A name and timestamps. **No owner column.** Table `auth_organizations` |
| **OrganizationMembership** | Joins a user to an organization and **carries the role**. Table `auth_organization_memberships` |
| **Membership** | Short for `OrganizationMembership` |
| **OrgRole** | The role type: `owner`, `admin` or `user` |

There are **two entities, and only two**. See [Models](./models.md).

## Roles

| Term | Definition |
|---|---|
| **role** | A membership's rank inside one organization. Never global, never from input |
| **owner** (role) | Highest rank. Everything `admin` can do. The organization's creator |
| **admin** | Destructive and structural writes: deletes, account structure, payment transaction edits, rename |
| **user** | Reads, plus everyday writes |
| **ranking** | `user` < `admin` < `owner`. A role allows everything a lower one allows |
| **`hasMinRole(role, min)`** | The comparison used for every role check |
| **`orgRoleForbidden()`** | Builds the one uniform `403` body |

Reads require **membership**, not a minimum role: every `GET` is open to `user`.

**No action is owner-only today.** Every action the `owner` can take, an `admin` can take too. That
is a statement about the current implementation, not about the design intent.

## The global admin

| Term | Definition |
|---|---|
| **global admin** / **`is_admin`** | A **platform** role, stored on the user record. Grants **no** organization access |
| **`AdminGuard`** / **`@AdminOnly()`** | The mechanism for the global admin. Separate from organization roles, and it does **not** bypass them |

The distinction matters because it is the most common wrong assumption: an admin who is not a member
of an organization gets the **same uniform `404`** as anyone else. See [Security](./security.md).

## Context

| Term | Definition |
|---|---|
| **context** | Which owner a request works for: Personal or one organization |
| **owner context** | The resolved form of that, stored on the request |
| **`OwnerContext`** | The discriminated union `{ kind: 'user' } \| { kind: 'organization', organizationId, role }` |
| **`OwnerScope`** | The same union **without** `role` - used where the owner is derived from a record rather than the request |
| **personal context** | No organization. Owner is the JWT user |
| **organization context** | One organization selected through `:orgId` |

### Prefixes

| Term | Definition |
|---|---|
| **personal prefix** | `/<module>/...` - no owner in the URL at all |
| **organization prefix** | `/orgs/:orgId/<module>/...` |
| **stripped path** | The path after `/orgs/<seg>` is removed - what the frontend routes against |

## Access control

| Term | Definition |
|---|---|
| **`OwnerContextGuard`** | The global `APP_GUARD` that resolves the owner on every request and acts only where `@OwnerScoped()` exists |
| **owner-scoped route** | A route carrying `@OwnerScoped()`, or mounted through `@OwnerScopedController()`. The guard is active on it |
| **`@OwnerScopedController(path)`** | Mounts a controller under both prefixes, adds `@OwnerScoped()` and sets `user-scoped` - inseparably |
| **`@CurrentOwner()`** | Injects the resolved `OwnerContext` into the handler |
| **`@MinOrgRole(role)`** | Declares a route's minimum role, read by the guard |
| **`ownerWhere()`** | Builds the owner filter for TypeORM `where` objects |
| **`ownerSqlWhere(scope, alias)`** | Builds it for raw SQL, bound to a table alias |
| **membership lookup** | The `ORGANIZATION_MEMBERSHIP_LOOKUP` port, implemented by `OrganizationService` |
| **`findRole(userId, orgId)`** | The port method. Returns the `OrgRole` or `null` |
| **`findMembership(userId, orgId)`** | Returns the membership row itself, for callers that need more than the rank |
| **`parseOrgId()`** | Parses `:orgId` from a **raw string**, so `1e3` is rejected rather than coerced to `1000` |
| **`@StrictBody()`** | Rejects unknown body fields. What closes the body as an owner source |
| **single-writer rule** | `OrganizationService#create` is the only code that writes memberships |

## Data model

| Term | Definition |
|---|---|
| **user-owned module** | Each record belongs to one user. The default kind |
| **user-or-organization-owned module** | Records may belong to a user or an organization. `bank` is the only one today |
| **owner-root record** | A record that holds the owner: two nullable, indexed, **logical** references - `user_id` and `organization_id` - with a check constraint that exactly one is set |
| **child record** | A record that **inherits** the owner through its root and never stores a copy |
| **logical reference** | A column that names another table's id **without a database foreign key**. `bank` tables reference `auth_organizations` this way |
| **`ON DELETE RESTRICT`** | The constraint on both membership foreign keys: a row cannot be deleted while referenced |

The logical-reference distinction matters at deletion time: the database will not stop an orphan in
`bank`, so the application must.

## Errors

| Term | Definition |
|---|---|
| **uniform 404** | One body for every resolution failure: malformed id, unknown id, foreign id, non-member, non-member global admin |
| **uniform 403** | One body for every role failure. Names neither the resource nor the required role |
| **404 before 403** | The ordering rule: membership is resolved before the role is compared, so a `403` is only reachable by a member |
| **`VALIDATION_FAILED`** | The `400` code for an invalid or non-whitelisted body |

The full bodies are in [Security](./security.md).

## Test vocabulary

| Term | Definition |
|---|---|
| **coverage spec** | `min-org-role.coverage.spec.ts`. Fails the build on a plain `@Body()` or an owner-scoped route declared `public` |
| **`data-access` checklist** | The ten review rules a reviewer applies. Not automated |
| **structural failure** | Visible in the decorators, without reasoning about behaviour - the coverage spec's domain |
| **semantic failure** | Passes the structural spec and breaks the contract - e.g. a query without `ownerWhere()`. The checklist's domain |

See [Tests](./tests.md).

## Status vocabulary

Two words used consistently across this documentation set:

| Term | Means |
|---|---|
| **`implemented`** | The behaviour exists and is covered by specs |
| **`target`** | Documented as intended, **not built**. Every `target` item carries an issue number |

Never read `target` as "works but undocumented", and never read `implemented` as "complete". The
organization surface is implemented with **one member per organization** and no way to join.

## Terms that do not exist

Listed because each one has been assumed at some point:

| Non-existent term | Reality |
|---|---|
| `OrganizationOwner` | No such entity. Ownership is the membership role |
| `OrganizationSettings` | No such entity. The organization is a name and timestamps |
| `OrganizationInvite` | No such entity. Joining is not built |
| `created_by` | No such column. The user reference on a record means **owner**, never creator |
| `member_count` | Not returned by any response |
| `slug` | Organizations have no slug. Only `id` and `name` |
| `ownerId` on the organization | No such column |
| Personal organization | Personal is a context, not an organization |
| Owner-only action | None exists today |

## What is not documented in the repository

The project documentation states the entities, the roles, the context union, the port names and the
error vocabulary. It does **not** contain:

- a **glossary section as such** - the terms on this page are assembled from the pages that define
  them, not quoted from a single source;
- the **declaring file** of the `OwnerContext` and `OwnerScope` types, though
  `backend/src/core/owner-context.ts` is the most likely candidate;
- whether the codebase uses `ownerId` and `ownerContext` as the naming convention this page
  describes - the docs distinguish the concepts, not the identifiers chosen for them;
- the naming of the `OwnerScope` variant used for record-derived owners beyond the union shape;
- any term for a record that is **neither** user-owned nor user-or-organization-owned, because no
  such third kind exists.

Nothing on this page invents a definition: each row restates a meaning established in
[Models](./models.md), [Roles](./roles.md), [Owner context](./owner-context.md) or
[Security](./security.md).
