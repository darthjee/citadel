# Organizations - Roles

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Glossary](./glossary.md), [Models](./models.md), [Service](./service.md),
[Owner context](./owner-context.md), [Security](./security.md).

## Summary

- Roles are stored on the membership: `OrganizationMembership.role`.
- Three roles, ranked `user` < `admin` < `owner`. A role allows everything a lower role allows.
- The role is **enforced on every request**, never taken from input, and **re-read from the
  database with no caching**.
- The **personal context counts as `owner`**.
- **No action is owner-only today.** Owner-only actions arrive with the deferred epics.
- Organization roles are **distinct from Ward's global admin role** (`User.isAdmin`), which
  grants **no** organization access.

## The three roles

Ranking from `backend/src/core/org-role.ts`. The numeric rank is the ordering concept, not a
stored value: only the three strings are persisted.

| Role | Rank | May |
|---|---|---|
| `user` | 1 | Read everything in the organization, and the **everyday writes**: create and edit transactions, bills and provider bills, pay or skip occurrences, mark accountant rows as sent / unsent |
| `admin` | 2 | Everything `user` may, plus the **destructive and structural writes**: every delete (including undoing a payment), the account structure (create, edit, archive, unarchive, delete accounts), editing a payment-generated transaction, and renaming the organization |
| `owner` | 3 | Everything `admin` may. The owner is the organization's creator |

- **Reads are open to every member**: every `GET` needs only membership, not a minimum role.
- **Inheritance, not separate permission sets**: `admin` is defined as `user` plus extras;
  `owner` as `admin` plus extras. There is no permission `owner` has that `admin` lacks today.
- The capability split is between **everyday writes** (`user`) and **destructive and structural
  writes** (`admin`). That is the line the design actually draws.

## Where the role lives

- **One place only**: the `role` column of `auth_organization_memberships`, `varchar(16)`, one of
  the three strings. See [Tables](./tables.md).
- There is **no role on the user**, no role on the organization, and no `roles` table.
- A user's roles are therefore **per organization**: the same person may be `owner` in one
  organization and `user` in another.

## How the role is set

- **Written when the membership is written.** The creator always gets `owner`.
- `OrganizationService#create` is the only code that writes memberships, and it always writes
  exactly one `owner` row in the same DB transaction as the organization. See
  [Service](./service.md).
- **Never taken from input.** Organization bodies accept only `name` (via `OrganizationNameDto`);
  any other field - `role` included - answers `400 VALIDATION_FAILED`.
- **No role-change endpoint exists.** Changing a role is target behaviour, part of the deferred
  member-management work (#82).

## The role is re-read on every request

This is a hard rule, stated in the module docs and in the `data-access` review checklist:

- The role used for any check comes **only from the DB membership**, through `findRole`.
- **No caching** of the role, on any layer.
- **No `is_admin` bypass** - a global admin gets no organization role.
- Consequence: a role changed in the database applies **immediately** on the next request. The
  frontend refreshes its copy of the role on any `403`.

## The personal context counts as `owner`

`ownerRole(ctx)` returns the organization role when the context is
`{ kind: 'organization', organizationId, role }`, and **`owner`** when it is
`{ kind: 'user', userId }`.

- The JWT user may therefore do everything on their own personal data - the same ceiling as an
  organization owner, applied to data they own alone.
- This is why the personal route set needs no separate permission matrix: the personal context is
  always the highest role.
- It does **not** mean a user gets `owner` anywhere else. Personal `owner` is scoped to personal
  records only.

## Enforcement points

Roles are enforced in three distinct places. Knowing which one applies to a route matters when
reading or adding code.

### 1. `@MinOrgRole(role)` on owner-scoped routes

- Declared on a **method or a class** (`backend/src/core/min-org-role.decorator.ts`).
- `OwnerContextGuard` reads it - **handler first, then class** - and throws the uniform 403 when
  `!hasMinRole(ownerRole(ctx), min)`.
- Only meaningful on routes that carry `@OwnerScoped()`: without it, the guard does nothing.
- Because the guard runs in order, the **membership 404 is thrown before the role 403**.

### 2. Service-level checks on organization routes

The organization routes (`/orgs.json`, `/orgs/:orgId.json`) are **not** owner-scoped, so
`@MinOrgRole` does not apply. The role check happens inside the service instead.

The documented example is rename: `OrganizationService.rename` performs
`hasMinRole(membership.role, ADMIN)` itself. See [Endpoints](./endpoints.md).

### 3. Record-dependent rules, failing closed

Some checks depend on the record, not only on the role - the documented case is
**editing a payment-generated transaction**, which needs `admin`. These are checked in the
service and **fail closed**.

## The `OrgRole` type and its helpers

All in `backend/src/core/org-role.ts`:

| Export | Role |
|---|---|
| The role values | `owner`, `admin`, `user` |
| `hasMinRole(role, min)` | The ranking comparison. Every role check goes through it |
| `orgRoleForbidden()` | Builds the **uniform 403** body |

### Why it lives in `core/`

- **`core` never imports `auth`.** Putting `OrgRole` in `core` lets the guard, the decorator and
  every owner-scoped module use it without importing the auth module.
- `auth`'s `MembershipRole` **re-exports** `OrgRole`. Same type, two import paths, **one
  definition**. Do not look for a second definition of the roles.

## The uniform 403

Every role failure - route minimum, payment-generated transaction, rename - answers the **same**
body, naming neither the resource nor the required role:

```json
{
  "error": { "code": "FORBIDDEN", "message": "Forbidden" },
  "statusCode": 403,
  "timestamp": "<ISO 8601>"
}
```

- The body never says which role was required.
- The body never says whether the resource exists.
- A `403` is only ever reached by a **member**. A non-member gets the uniform `404` instead - see
  [Security](./security.md).

## 404 before 403

The ordering rule, and why it matters:

1. Resolve the user.
2. Parse `:orgId` strictly (`parseOrgId()`).
3. Look up the membership. **Any** failure - missing user, malformed or unknown id, non-member,
   non-member global admin - throws the uniform **404**.
4. Only then read the route's `@MinOrgRole` and throw the uniform **403** if the role is too low.

Consequence: a 403 is **never** used to reveal that an organization exists. A non-member cannot
distinguish "no such organization" from "organization exists but you are not in it".

## No owner-only action today

- `owner` is the highest role, but **no action requires it**. Everything the owner can do, an
  `admin` can do too.
- The single `owner` membership exists to guarantee that every organization has a highest-ranking
  member, not to gate any route today.
- **Owner-only actions are deferred** with the member-management and lifecycle epics. See
  [Roadmap](./roadmap.md).

## Target member-management rules (not built)

These are documented targets, for [#82](https://github.com/darthjee/ward/issues/82) (joining,
members, leave, transfer) and [#83](https://github.com/darthjee/ward/issues/83) (closing):

| Actor | Would be allowed |
|---|---|
| `admin` | Manage only `user` members |
| `owner` | Manage `admin`s, transfer ownership, close the organization |

None of it exists: there is no invite, no member list, no leave, no transfer and no close.
With no way to join, **every organization has exactly one member: its owner**.

## Organization roles versus the global admin

These are two unrelated systems. Mixing them up is the most common authorization mistake in this
project.

| | Organization role | Global admin |
|---|---|---|
| Stored on | `auth_organization_memberships.role` | `auth_users.is_admin` |
| Scope | One organization | The whole platform |
| Guards | `OwnerContextGuard`, `@MinOrgRole`, service checks | `JwtGuard` + `@AdminOnly()` |
| Covers | That organization's data | **Accounts only** |
| Grants organization access | Yes, within that organization | **No** - same 404 as anyone else |

- A Ward admin who is not a member gets the **uniform 404**, not a 403 and not access.
- Being an organization `owner` grants **nothing** outside that organization.
- **Personal data is owner-only**: never visible to organization members - even of an
  organization the owner belongs to - nor to the global `is_admin`.

## Role matrix per route - where to find it

This page documents the roles, the mechanism and the capability split. It does **not** reproduce
the full per-route matrix.

- The per-route minimum-role matrix lives in
  [Bank routes -> Minimum role](../../backend/routes/bank.md#minimum-role). `bank` is the only
  module with owner-scoped routes today, so it is where the matrix is meaningful.
- The organization routes' own role rules are on [Endpoints](./endpoints.md): both `GET`s are open
  to every member, `POST /orgs.json` has no role gate, and `PATCH /orgs/:orgId.json` needs
  `admin` or `owner`.

## What is not documented in the repository

- The exact source of `org-role.ts`: the literal values of the ranking constants, the function
  signatures beyond their names, and how the 403 body is assembled.
- Whether the ranking is a numeric map, an array order, or a comparison chain.
- The `bank` per-route matrix, which is documented in `bank.md` but not reproduced here.

Nothing on this page is inferred beyond what the docs state.
