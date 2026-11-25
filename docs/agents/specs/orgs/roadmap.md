# Organizations - Roadmap

Hub: [Organizations](README.md).

## Summary

Everything on this page is **target behaviour: documented as intended, not built**.

| Issue | Epic | Would change |
|---|---|---|
| [#82](https://github.com/darthjee/ward/issues/82) | Joining organizations - invites, members, leave, transfer ownership | The membership lifecycle, the role rules, the response shape |
| [#83](https://github.com/darthjee/ward/issues/83) | Closing (deleting) organizations | The delete path, the `ON DELETE RESTRICT` resolution, what happens to data |
| [#84](https://github.com/darthjee/ward/issues/84) | Organization-creation rate limit | `POST /orgs.json` |
| [#93](https://github.com/darthjee/ward/issues/93) | Move a record between owners | The owner-root model of user-or-organization-owned modules |
| [#94](https://github.com/darthjee/ward/issues/94) | Share a personal record with an organization | The same |
| [#95](https://github.com/darthjee/ward/issues/95) | Authorship / audit trail | Adds a `created_by` concept to the owner-root model |

Two further epics appear in the module docs as **deferred context**, without a dedicated section:
the permission-system frontend counterpart (#144, **built**) and the organization frontend (#47,
**built**). The six issues above are the open work.

## Built

For reference, so this page reads as a delta rather than a wish list.

| Issue | What it delivered |
|---|---|
| [#26](https://github.com/darthjee/ward/issues/26) | The organization epic itself |
| [#28](https://github.com/darthjee/ward/issues/28) | The first organization spec - **superseded by #40** before being built |
| [#40](https://github.com/darthjee/ward/issues/40) | Reversed #28: no organization at registration |
| [#46](https://github.com/darthjee/ward/issues/46) | Backend: entities, migration, service, controller, owner-context mechanism |
| [#47](https://github.com/darthjee/ward/issues/47) | Frontend: context switcher, remembered context, routing, pages |
| [#81](https://github.com/darthjee/ward/issues/81) | The organization permission system epic |
| [#143](https://github.com/darthjee/ward/issues/143) | Backend role enforcement |
| [#144](https://github.com/darthjee/ward/issues/144) | Frontend role enforcement |

## #82 - Joining organizations

The largest of the six, and the one that unlocks the others.

### Documented target behaviour

- **Any member except the owner may leave.**
- **The owner cannot leave** without first:
  - **transferring ownership** - the target becomes `owner`, the previous owner becomes `user`; or
  - **closing the organization** (#83).
- **Transfer and close are owner-only.**
- An `admin` manages only `user` members.
- The `owner` manages `admin`s, transfers ownership and closes the organization.

This is the first epic that introduces **owner-only actions** - the current matrix has none.

### What is missing today

| Capability | Status |
|---|---|
| Invite a user | Does not exist |
| List the members of an organization | **No endpoint**, and the response shape deliberately carries none |
| Change a member's role | Does not exist |
| Leave | Does not exist |
| Transfer ownership | Does not exist |
| Any owner-only action | **None exists.** Every action an owner can take, an `admin` can too |

### What it would break, and why the design anticipated it

| Area | What must change | Why |
|---|---|---|
| `OrganizationService#create` is the **only** membership writer | A second writer arrives | The "exactly one owner" invariant is held by that single-writer property, **not by a DB constraint**. Nothing in the database will catch a violation |
| The minimal response shape | A member list becomes needed | Adding `members` to the organization response would turn four routes into an enumeration surface. It should come as a dedicated endpoint with its own authorization |
| Role rules | Owner-only actions appear for the first time | The roles matrix currently has no owner-only row |
| `findRole` returning `null` | A joined member is a new state | Still fine - membership is membership - but the "one member always" assumption disappears from tests and fixtures |
| Frontend controls | `MANAGE_MEMBERS`-style actions | `can()` must mirror whatever the backend enforces; a divergence shows a control the API refuses |
| The "organization with a single member" statement | No longer universally true | The whole edge-case section is a statement about the current state |

### The invariant at risk

Stated plainly because it is the most likely casualty: **"exactly one owner" has no database
enforcement.**

There is no partial unique index on `role = 'owner'`. Today it holds because `create` is the only
writer and always writes one `owner`. A join or transfer path introduces a second writer, and the
invariant then depends on that new code getting it right - including inside its own transaction.

See [Service](./service.md) and [Roles](./roles.md).

## #83 - Closing (deleting) organizations

### Documented target behaviour

- Closing an organization is an **owner-only** action.
- It is the alternative to transferring ownership when the owner wants to exit.

### The hard blocker

`auth_organization_memberships` references `auth_organizations` with **`ON DELETE RESTRICT`**.

Consequence: **no organization row is deletable while any membership references it.** Since every
organization always has at least its `owner` membership, and removing memberships is not built,
**deleting an organization is impossible today at every layer**.

So #83 is not a delete endpoint added to the controller. It must first answer:

1. **Who removes the memberships**, and in what order, inside which transaction?
2. **What happens to the organization's data** in user-or-organization-owned modules such as `bank`?
   Those records carry a **logical** `organization_id` - not a foreign key - so nothing in the
   database will cascade, block or warn.
3. **Does the data survive the organization?** The module docs say organization data **outlives its
   creator's membership or account status** - which argues against a hard delete, and toward
   archiving or a soft-delete.
4. **What does a denied or departed owner leave behind?** See [Edge cases](./edge-cases.md).

### Why the logical reference matters here

The `bank` tables do not have a foreign key to `auth_organizations`. That was deliberate - the
modules are separate. The cost arrives precisely at deletion time: the database will not stop an
orphan, so the application must.

## #84 - Organization-creation rate limit

### Documented target behaviour

Rate-limit `POST /orgs.json`.

### Why it carries security weight

Unlike the other five, this one closes a gap that is **open right now**:

- **No cap per user.** Nothing limits how many organizations an account may create.
- **No throttle.** A user may create organizations as fast as the platform accepts requests.
- `GET /orgs.json` has **no pagination**, so a user with many organizations receives the whole array,
  and the context switcher renders every entry.

This is the one documented gap with direct security consequence - see [Security](./security.md).

## #93 - Move a record between owners

### Documented target behaviour

Move a record from one owner to another - user to user, user to organization, or organization to
organization.

### What it touches

- The owner-root model: two nullable, indexed, **logical** references (`user_id`,
  `organization_id`) with a DB check constraint that exactly one is set.
- There is **no `created_by` column** (#95), so after a move there is no breadcrumb of where the
  record came from.
- Child records **inherit the owner through their root** and never store a copy - which is what
  makes a move feasible at all: only the root row changes.

### The consequence for this domain

Moving a record into an organization makes previously personal data visible to every member of it.
The module docs treat that as a distinct decision: sharing a personal record is **#94**, not #93.

## #94 - Share a personal record with an organization

### Documented target behaviour

Make one personal record visible to an organization, without moving its ownership.

### Why it is separate from #93

The docs distinguish them explicitly, and the distinction is a security one:

- **#93 moves** - the owner changes, the record leaves the personal context.
- **#94 shares** - the owner stays a user, but members gain visibility.

The second is the harder case for the entire owner-context mechanism, because
`OwnerContextGuard` resolves **exactly one** owner per request. A record visible to both its owner
**and** an organization does not fit `{ kind: 'user' } | { kind: 'organization' }`. It would need a
third state, or a grant table, and every `ownerWhere()` / `ownerSqlWhere()` call site would have to
understand it.

The module docs state that **personal data is owner-only**: never visible to organization members,
even members of an organization the owner belongs to, nor to the global `is_admin`. #94 would be the
epic that redefines that sentence.

## #95 - Authorship / audit trail

### Documented target behaviour

Record who created a record.

### Why it is deliberately absent

The docs are explicit that there is **no `created_by` column**, and that the user reference on a
record means **owner, never creator**:

- An organization record has `user_id` `NULL` even though a member created it.
- That is what makes a personal query **structurally unable** to return an organization record.

Adding `created_by` would be a new, separate column - not a redefinition of `user_id`. The docs
anticipate the distinction.

### What it would change in this domain

- `organization-response.ts` is an **allowlist**: a new column is not automatically public. A
  `created_by` field would have to be added deliberately, and would expose a user id - which the
  current shape never does.
- It would give #93's moves a trail, which is the main argument for sequencing it first.

## Blast radius across this series

Useful for estimating any of the six: which files in this documentation set would need a rewrite.

| Epic | Files most affected |
|---|---|
| #82 | Models, Tables, Roles, Service, Response, Endpoints, Edge cases, Tests, Frontend |
| #83 | Tables, Migrations, Service, Endpoints, Security, Edge cases |
| #84 | Endpoints, Security, Caching |
| #93 | Models, Owner context, Security, Edge cases |
| #94 | Models, Owner context, Security, Roles, Edge cases |
| #95 | Models, Tables, Migrations, Response, Edge cases |

**Owner context** is the file that ages best for #82 and worst for #94: joining does not disturb it,
but sharing does, because the mechanism is built on resolving exactly one owner.

## Sequencing observations

No priority is documented. What the dependencies imply:

- **#84 is independent** of the other five and is the only one closing an open gap. It could ship
  alone at any time.
- **#83 depends on #82.** Deleting an organization requires resolving memberships, and the ability
  to remove a membership is #82.
- **#95 helps #93.** A move without an audit trail leaves no record of the previous owner.
- **#94 is the most invasive.** It is not an extension of the owner-context mechanism; it is a
  change to what "owner" means.
- **#82 is the gate.** Members, roles, leave and transfer all assume more than one member exists,
  and today no organization can have one.

## Documented divergence that will not change

The docs list these as accepted differences between the original spec and the implementation.
They are recorded here so they are not mistaken for pending work:

| Item | Spec said | Implementation |
|---|---|---|
| Table names | `organizations` / `organization_memberships` | `auth_organizations` / `auth_organization_memberships` |
| Foreign keys | not specified | `ON DELETE RESTRICT` on both |
| "Exactly one owner" | a constraint | enforced by `OrganizationService#create` being the only writer |
| Name validation | length only | also rejects control characters, counts **code points** |
| `PATCH` validation | - | body validated **first**, so an invalid body answers `400` even for an unknown organization |
| Owner-context mechanism | "a core guard behind a DI token" | concrete names: `OwnerContextGuard`, `ORGANIZATION_MEMBERSHIP_LOOKUP`, `@OwnerScopedController()`, `@OwnerScoped()`, `@CurrentOwner()`, `@MinOrgRole()`, `ownerWhere()`, `ownerSqlWhere()` |
| Unknown body fields | rejected by the whitelist `ValidationPipe` | rejected by `@StrictBody()` |
| `/api` prefix | spec wrote `/api/...` | no prefix in the backend; the proxy adds it |
| Organization list order | not specified | **ordered by id** |

## What is not documented in the repository

The `docs/agents/` pages state the six open issues, their target behaviour and the divergences
above. They do **not** contain:

- **priority or sequencing** for the six - the ordering observations on this page are derived from
  the stated dependencies, not from a documented plan;
- any **plan document** for these epics under `docs/agents/plans/`;
- **issue specs** for #82, #83, #84, #93, #94 or #95 under `docs/agents/issues/` - the plan and
  issue folders are structured and mostly empty at the time of writing;
- whether #83 intends a **hard delete, a soft delete or an archive**, and what happens to the data
  of user-or-organization-owned modules;
- whether #94 introduces a **grant table**, a third `OwnerContext` variant, or something else;
- whether #82 adds an **invite** model or only direct member addition;
- whether the **`members` response** arrives as a nested field or a dedicated endpoint - the
  recommendation on this page follows from the enumeration argument, which is documented, but the
  shape is not decided in the docs;
- any timeline. No dates are given anywhere for these epics.

Read `docs/agents/modules/auth/organizations.md` and the linked issues for the authoritative
version of the target behaviour. Nothing on this page is inferred beyond what the docs state, and
the sequencing section is explicitly derived.
