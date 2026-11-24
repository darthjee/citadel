# Organizations - Glossary

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [General](./general.md), [Models](./models.md), [Roles](./roles.md),
[Owner context](./owner-context.md).

## Why this page exists

The organization domain uses one word - **owner** - for two different things, and uses the word
**personal** for something that is not an entity. Most misreadings of this module come from
those two ambiguities. This page fixes the vocabulary before any other page uses it.

## The two meanings of "owner"

Read this table before anything else.

| Term | Means | Where it lives | Does not mean |
|---|---|---|---|
| **owner** (role) | A value of `OrganizationMembership.role`. The highest role in the ranking `user` < `admin` < `owner` | `auth_organization_memberships.role`; type `OrgRole` in `backend/src/core/org-role.ts` | It does **not** name a column on the organization, and it is not a flag on `Organization` |
| **owner** (of a record) | The single context - a user or an organization - that a domain record belongs to | The `user_id` / `organization_id` pair on an owner-root record of a user-or-organization-owned module (today only `bank`) | It is **not** the creator of the record and not the membership role |

Whenever a document in this series says **owner** without qualification:

- in the context of memberships, roles and permissions, it means the **role**;
- in the context of domain data, filtering and queries, it means the **record owner**.

The docs under `docs/agents/` use the phrase *"here owner means a record's owner context, not the
membership role"* at exactly the points where the ambiguity would otherwise appear.

## Ownership vocabulary

| Term | Definition |
|---|---|
| **owner-root** | A record that carries the owner itself, as two nullable, indexed, **logical** references (`user_id`, `organization_id`) with a DB check constraint that exactly one is set. Every module of the user-or-organization-owned kind has one owner-root table |
| **child record** | A record whose owner is not stored: it **inherits the owner through its root**. Copying the owner onto a child is a defect |
| **user-owned module** | A module where each record belongs to exactly one user through a logical `userId`. The default for the planned `protocol`, `car-performance` and `links` |
| **user-or-organization-owned module** | A module where every owner-root record belongs to either a user or an organization. `bank` is the only one today |
| **owner as owner, never creator** | The rule that an organization record has `user_id` `NULL` even though a member created it, so a personal query can never return it. There is no `created_by` column (see #95) |
| **logical reference** | A reference enforced by application code, not by a database foreign key, because the two tables live in different modules. The owner references of user-or-organization-owned modules are logical; the references inside `auth` are **real** FKs |
| **real FK** | A database-enforced foreign key. `auth_organization_memberships` uses real FKs to `auth_organizations` and `auth_users`, both `ON DELETE RESTRICT` |

## Context vocabulary

| Term | Definition |
|---|---|
| **active context** | Which owner the current request works on: Personal or one organization. It lives **in the URL**, so several browser tabs can work on different contexts at once |
| **Personal** | The context label for the current user's own data: backend `/<module>/...`, UI `#/<module>/...`. It is **a context label only** - not an organization and not a flag on `Organization` |
| **personal prefix** | A backend route without `:orgId`, for example `/bank/accounts.json`. The owner is always the JWT user, never the URL or the body |
| **organization prefix** | A backend route with `/orgs/:orgId/...`. `:orgId` is parsed by `parseOrgId()` and the membership is checked on every request |
| **context switcher** | The UI control listing Personal, each of the user's organizations, and **Create organization**. With zero organizations it shows only Personal and Create organization |
| **remembered context** | The frontend's stored copy of the last used context. A context the user no longer belongs to is dropped and the UI falls back to Personal |

## Authorization vocabulary

| Term | Definition |
|---|---|
| **membership** | The `OrganizationMembership` row joining a user to an organization, carrying the role. This row, and only this row, is the source of truth for what the user may do |
| **role** | `owner`, `admin` or `user`, stored on the membership, set at creation, and **re-read from the DB on every request** with no caching |
| **OrgRole** | The role type and its helpers, defined in `backend/src/core/org-role.ts`: the ranking, `hasMinRole(role, min)` and `orgRoleForbidden()`. It lives in `core/` so `core` never imports `auth`; `auth`'s `MembershipRole` re-exports it |
| **MembershipRole** | The `auth`-side name that re-exports `OrgRole`. Same type, two import paths, one definition |
| **personal context counts as owner** | The rule that `ownerRole(ctx)` returns `owner` when the context is `{ kind: 'user', userId }`, so the JWT user may do everything on their own data |
| **global admin** / **`is_admin`** | Ward's platform-level administrator (`User.isAdmin`, `@AdminOnly()`). It covers **accounts only** and grants **no** organization access. Distinct from every organization role |
| **uniform 404** | One single response body for an unknown, non-numeric or foreign `:orgId`, and for a non-member - a global admin included |
| **uniform 403** | One single response body for every role failure, naming neither the resource nor the required role |
| **404 before 403** | The ordering rule: the membership check always runs first, so a 403 never tells a non-member that an organization exists |
| **no `is_admin` bypass** | The rule that a Ward admin who is not a member gets the same 404 as anyone else, on every organization path |

## Mechanism vocabulary

| Term | Definition |
|---|---|
| **`OwnerContext`** | The resolved owner of a request, as a discriminated union: `{ kind: 'user', userId }` or `{ kind: 'organization', organizationId, role }`. Stored on `request.ownerContext` |
| **`OwnerScope`** | The same union **without** `role`, also used for owners derived from a record |
| **`OwnerContextGuard`** | The global `APP_GUARD` (`backend/src/core/owner-context.guard.ts`), registered after `JwtGuard`, that resolves the owner in one place so the check cannot be forgotten per route. It does nothing on routes without `@OwnerScoped()` |
| **`@OwnerScoped()`** | Route metadata that activates `OwnerContextGuard` on that route |
| **`@OwnerScopedController(path)`** | Controller decorator that mounts a controller under both `<path>` and `orgs/:orgId/<path>`, adds `@OwnerScoped()`, and sets the cache class to `user-scoped` - so mounting, scoping and cache class cannot be separated |
| **`@CurrentOwner()`** | Handler decorator that injects the resolved `OwnerContext`. Services receive only this context, never a raw id |
| **`@MinOrgRole(role)`** | Route decorator declaring the minimum role for that route. `OwnerContextGuard` reads it - handler first, then class - and throws the uniform 403 when the role is too low |
| **`ownerWhere()` / `ownerSqlWhere()`** | The helpers in `core/owner-context.ts` that build the owner filter for TypeORM `where` objects and for raw SQL, so every query is filtered by owner |
| **`ORGANIZATION_MEMBERSHIP_LOOKUP`** | The port the guard depends on, so `core/` never imports `auth/`. Its single method, `findRole(userId, orgId)`, returns the member's `OrgRole` or `null` |
| **`parseOrgId()`** | The strict parser in `core/parse-org-id.ts`. It takes `:orgId` as a raw string, so `1e3` never becomes `1000` |
| **`@StrictBody()`** | The pipe in `core/strict-validation.pipe.ts` through which handlers take bodies. Unknown fields - owner fields included - answer 400 |

## Data vocabulary

| Term | Definition |
|---|---|
| **`Organization`** | The entity in `auth_organizations`: `id`, `name`, `created_at`, `updated_at`. No owner column |
| **`OrganizationMembership`** | The entity in `auth_organization_memberships`: `id`, `organization_id`, `user_id`, `role`, `created_at`, `updated_at` |
| **exactly one owner** | The invariant that an organization has exactly one `owner` membership at all times. **Not a DB constraint**: it holds because `OrganizationService#create` is the only code that writes memberships, always writing one `owner` row in the same transaction as the organization |
| **membership lookup index** | The unique index on `(organization_id, user_id)`. It enforces one membership per user per organization and also serves `findRole` |

## Cache vocabulary

| Term | Definition |
|---|---|
| **`never`** | The cache class for writes. Sends `X-Skip-Cache: true` and `Cache-Control: no-store` |
| **`user-scoped`** | The cache class for reads, cached per caller. An organization id in the URL does **not** make a response public; personal routes carry no owner in the URL, so they **must** be `user-scoped` with no exception |

## Status vocabulary

| Term | Definition |
|---|---|
| **implemented** | Behaviour that exists in the code today and is covered by specs |
| **target** | Behaviour that is documented as intended but **not built**. Appears in [Roadmap](./roadmap.md) with its issue number |

## Ground rules that follow from the vocabulary

1. **Never say "the owner column"** about an organization - there is none. Ownership lives only in the membership role.
2. **Never say "creator"** where the docs mean record owner. An organization record has `user_id` `NULL`.
3. **Never call Personal an organization.** It is a context label.
4. **Never treat `is_admin` as an organization role.**
5. **Never take `role` or `organizationId` from input.** The role comes only from the DB membership; the organization comes only from the URL after the membership check.
