# Organizations - General

Hub: [Organizations](../orgs.md).

## What an organization is

Organizations let domain data belong to a group of users instead of a single user. Any module
may reuse the concept, so it lives next to the user entity - not inside a domain module.

Epic #26, with sub-issues #28 and #40. Backend built by #46, frontend by #47. Role enforcement
comes from the *Organization permission system* epic #81, built by #143 (backend) and #144
(frontend).

## Summary

- Two entities only: **`Organization`** and **`OrganizationMembership`**.
- Membership **roles** (`owner` / `admin` / `user`) are **enforced**, not decorative. Reads are
  open to every member, everyday writes need `user`, destructive and structural writes need
  `admin`, and the owner is the creator.
- Every organization has **exactly one owner**: its creator.
- Organizations are **optional**. Registration creates none, and belonging to **zero
  organizations is the normal state**.
- The **active context** (Personal or an organization) lives in the URL.
- Domain data is either **user-owned** or **user-or-organization-owned**, one kind per module.
  `bank` is the only user-or-organization-owned module today.

## Design principles

### Exactly two entities

An `Organization` holds a name and timestamps. An `OrganizationMembership` joins a user to an
organization and carries the role. There is **no owner column on the organization**: ownership
lives only in the membership role.

### Exactly one owner - enforced by code, not by the database

This is not a DB constraint. It holds because `OrganizationService#create` is the only code that
writes memberships, and it always writes exactly one `owner` row in the **same DB transaction**
as the organization. Any future writer of memberships must preserve that invariant.

### Organizations are optional

Registration touches only the user table: no organization and no membership are created. The first
organization spec (#28) auto-created one at registration; #40 reversed that before it was built.
Users create organizations from the **Create organization** entry of the context switcher,
through `POST /orgs.json`.

### The active context lives in the URL

- **Personal** - the current user's own data: backend `/<module>/...` (for example
  `/bank/accounts.json`), UI `#/<module>/...`.
- **an organization** - backend `/orgs/:orgId/<module>/...`, UI `#/orgs/:orgId/<module>/...`.

The proxy adds the external `/api` prefix to backend paths. Because the context is in the URL,
several browser tabs can work on different contexts at the same time.

### One ownership kind per module

Each module declares a single ownership kind and never mixes both:

- **User-owned** - each record belongs to one user through a logical `userId`. This is the
  default for the planned `protocol`, `car-performance` and `links`.
- **User-or-organization-owned** - every **owner-root** record has exactly one owner, either a
  user or an organization, stored as two nullable, indexed, **logical** references (`user_id`,
  `organization_id`) with a DB check constraint that exactly one is set. **Child records inherit
  the owner through their root** and never store a copy. `bank` is the only module of this kind.

The user reference means **owner, never creator**: an organization record has `user_id` `NULL`
even though a member created it, so a personal query can never return it. There is no
`created_by` column (see the *Authorship / audit trail* epic, #95).

### Personal is a context label only

"Personal" is not an organization and not a flag on `Organization`. It is the label of the
context in which the JWT user operates on their own data.

## Roles at a glance

Roles are ranked `user` < `admin` < `owner` (`org-role.ts` in the core layer); a role allows
everything a lower role allows.

| Role | May |
|---|---|
| `user` | read everything in the organization, and everyday writes: create and edit transactions, bills and provider bills, pay or skip occurrences, mark accountant rows as sent or unsent |
| `admin` | everything `user` may, plus destructive and structural writes: every delete (including undoing a payment), the account structure (create, edit, archive, unarchive, delete accounts), editing a payment-generated transaction, and renaming the organization |
| `owner` | everything `admin` may. The owner is the organization's creator |

- **Reads are open to every member**: every `GET` needs only membership.
- **The personal context counts as `owner`**: the JWT user may do everything on their own data.
- **No action is owner-only today.** Owner-only actions arrive with the deferred epics.
- The role **never comes from input**: it is read only from the DB membership, re-read on every
  request, with no caching.

Organization roles are **distinct from the global admin role** (a platform-level `isAdmin` flag).
The global admin grants **no** organization access: an admin who is not a member gets the same 404
as anyone else. Being an organization `owner` grants nothing outside that organization.

## Security posture

- **404 before 403.** A non-member gets the uniform 404; a member whose role is too low gets the
  uniform 403. The 404 check always runs first, so a 403 never reveals that an organization or
  record exists.
- **Uniform 404.** An unknown, non-numeric or foreign `:orgId`, and a non-member (a global admin
  included), all answer the same body.
- **No global-admin bypass** anywhere in the organization path.
- **Personal routes carry no user id.** Personal always means the JWT user, so another user's
  personal data cannot be addressed.
- **No client-supplied owner or role.** `organizationId` comes only from the URL, after the
  membership check. Organization bodies accept only `name`.
- **Minimal responses.** Organization routes return only `id`, `name`, the caller's `role` and
  timestamps - never member lists or other users' ids.
- **Personal data is owner-only**: never visible to organization members (even of an organization
  the owner belongs to) nor to the global admin.

## What exists today

The only organization-level actions are:

- **create** - any approved user, through `POST /orgs.json`; the caller becomes `owner`;
- **rename** - `admin` or `owner`, through `PATCH /orgs/:orgId.json`;
- **list** - every organization the caller belongs to, through `GET /orgs.json`;
- **read one** - through `GET /orgs/:orgId.json`.

There is no join, no members list, no leave, no transfer-ownership and no close. With no way to
join, **every organization has exactly one member: its owner**.

## Deferred work

These are documented targets, not built behaviour:

- Joining organizations (invites, members, leave, transfer): #82.
- Closing (deleting) organizations and what happens to their data: #83.
- Organization-creation rate limit on `POST /orgs.json`: #84.
- Moving a record between owners: #93.
- Sharing a personal record with an organization: #94.
- Authorship / audit trail: #95.

## Where to read next

- [Glossary](./glossary.md) - `owner` as role versus `owner` as record owner.
- [Models](./models.md) and [Tables](./tables.md) - the two entities and their physical schema.
- [Roles](./roles.md) - the permission matrix in full.
- [Owner context](./owner-context.md) - how the owner of every request is resolved in one place.
- [Endpoints](./endpoints.md) - per-endpoint behaviour, payloads and filters.
- [Security](./security.md) - the contract behind the 404/403 rules.
