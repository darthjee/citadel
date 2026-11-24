# Organizations - Edge Cases

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [General](./general.md), [Security](./security.md), [Frontend](./frontend.md),
[Roadmap](./roadmap.md).

## Summary

The documented edge cases, and what each one does:

| Case | Outcome |
|---|---|
| **Zero organizations** | The **normal state**. The user works in Personal |
| **Pending or denied user** | Cannot log in, so reaches nothing. Memberships and personal data are kept but unreachable |
| **Many organizations** | **No cap** per user. Rate-limiting creation is not built (#84) |
| **Stale remembered context** | The frontend **drops** the id and falls back to Personal |
| **Role changed mid-session** | Applies **immediately** backend-side; the UI catches up on the next `403` |
| **Concurrent renames** | **Last write wins.** No optimistic locking |
| **Malformed `:orgId`** | Uniform `404` backend-side; `not-found` view client-side with **no request** |
| **Organization not in the org list** | `role` is `null`, and role-gated UI **renders nothing** |
| **Zero members other than the owner** | The only state that exists today, by design |

Each case is expanded below.

## Zero organizations

**This is the normal state, not an edge case in the negative sense.**

- Registration creates **no** organization and **no** membership. `POST /auth/register.json`
  touches only `auth_users`.
- A brand-new user therefore belongs to zero organizations, and that is expected.
- `GET /orgs.json` answers **`200`** with an **empty array** - not a `404`, not `null`.
- The UI's context switcher shows only **Personal** and **Create organization**.
- Everything the user does happens in the **personal context**, where they hold `owner` rights over
  their own data.

The first organization spec (#28) would have auto-created an organization at registration. #40
reversed that **before it was built**, which is why zero organizations is deliberate rather than an
oversight.

## Pending or denied user

Two distinct states with different mechanics.

### Pending

- Registration issues a **real session** - identical to an approved login - that the gate **blocks**
  until approval.
- `status.json` answers `{ "loggedIn": false, "isAdmin": false, "status": "pending" }` and the
  session is **kept**, not destroyed.
- Every access token is refused by the gate: the organization routes answer the uniform **`401`**.
- The UI **hides the context switcher** while logged out or pending, and an approval gate stands in
  front of the pages.

### Denied

- Cannot log in at all: a correct password on a `denied` user answers **`403 USER_DENIED`** with no
  session, no cookie and no refresh token.
- An existing session's tokens are refused by the gate, so organization routes answer **`401`**.
- **Nothing is deleted.** A denied user's **memberships and personal data are kept but
  unreachable**.
- **Organization data they created belongs to the organization**, not to them, and outlives their
  access. The record's `user_id` was `NULL` from the start - the owner is the organization.

This is the case where the "owner as owner, never creator" rule pays off: suspending a user does
not orphan organization records, because they were never owned by that user.

### The gap this exposes

A denied user's memberships **still exist**, and nothing removes them. Since the only organization
action is create and rename, and removing a member is not built (#82), an organization created by a
denied user keeps that `owner` membership indefinitely. The organization remains reachable only by
no one, because no other member was ever possible.

## Many organizations

- **No cap per user.** Nothing limits how many organizations a single account may create.
- Rate-limiting `POST /orgs.json` is documented target behaviour, **not built** (#84).
- Consequence today: a user may create organizations as fast as the platform accepts requests.
  This is the one documented gap with direct security weight - see [Security](./security.md).
- `GET /orgs.json` returns all of them, ordered by id, with **no pagination**. A user with many
  organizations receives a proportionally large array, and the context switcher renders every one.

## Stale remembered context

The frontend remembers the last used context per user under **`ward.context.<userId>`**, storing
the **organization id only**.

- It is applied **only at the entry point** (`''` or `#/`), and **only after** the org list loads.
- It is applied **only if the id is in that list** - otherwise it is **forgotten**.
- A stale id - an organization the user no longer belongs to - therefore **never** produces a
  request to a foreign organization. The frontend drops it silently and falls back to Personal.
- A backend `404` or a malformed id on an explicit URL renders the generic `NotFound` view, which
  **also forgets that id if it was remembered**.

Three details worth knowing:

1. **It is not cleared on logout**, so logging back in returns the user to the last organization,
   provided they still belong to it.
2. **Deep links bypass it.** A link to `#/orgs/7/bank/accounts` goes to organization 7 regardless
   of what was remembered.
3. **Storage failures mean Personal.** Every access to local storage is wrapped in `try` / `catch`;
   unavailable storage is treated as "no remembered context".

## Role changed mid-session

Two halves, one on each side of the wire.

### Backend: immediate

- The role is **re-read from the DB on every request**, with no cache and no `is_admin` bypass.
- A role changed in the database therefore applies on the **very next request**, including a
  demotion that must now be refused.
- There is no session-level role snapshot to invalidate.

### Frontend: on the next `403`

- The UI holds a copy of the role, taken from `GET /orgs.json`.
- `ApiClient` emits **`permission:forbidden`** on **any** `403`, **before** throwing the `ApiError`.
- The provider mounts **`forbiddenRefreshEffect`** with `refreshOrgs`, and an **in-flight flag
  collapses a burst of `403`s into one refresh**.
- Result: the UI catches up on the **next failed action**, not on the next page load and not on a
  timer.

The visible sequence for a demoted admin is therefore: their controls are still shown, they click
one, the backend answers `403`, the UI refreshes the role, and the controls disappear.

**Until that `403` happens, the UI may still offer actions the backend will refuse.** That is not a
security hole - the backend is the authority - but it is a real UX sequence worth knowing when
testing a demotion.

### A role changed while the user is on a page

- Since pages are **keyed by context**, switching organizations remounts them, so no page keeps
  another context's state.
- A role change **within** the same organization does not remount anything: only the `403` path
  refreshes it.

## Concurrent renames

- **Last write wins.** There is no optimistic locking, no version column and no `If-Match`.
- Two simultaneous `PATCH /orgs/:orgId.json` calls leave **one** of the two names, chosen by write
  order.
- This is a **documented acceptance**, not an oversight.
- No other concurrent write exists to race: creation inserts a new row, and there is no delete, no
  role change and no membership change.

## Malformed or unknown `:orgId`

The two layers behave differently, and deliberately so.

### Backend

- `:orgId` is parsed by **`parseOrgId()`** as a **raw string**. `1e3` never becomes `1000`.
- **Every** failure - non-numeric, unknown, foreign, or not a member - answers the same uniform
  **`404`**.
- A global admin who is not a member gets that same `404`.

### Frontend

- The resolver mirrors the strictness: a segment outside **`^[1-9][0-9]*$`**, or above
  **`2147483647`**, resolves to **`not-found` with no request issued at all**.
- So a typo in the address bar produces the `not-found` view **without** a `404` round trip.
- A **well-formed but unknown** id does reach the backend, gets the `404`, and also renders
  `not-found`.

The difference matters when debugging: the network tab tells you which case you hit.

## Organization not in the org list

A UI state the docs call out explicitly:

- `role` comes from the active organization's entry in `GET /orgs.json`.
- While the list is **loading**, or when the organization **is not listed**, `role` is **`null`**.
- `DEFAULT_OWNER_CONTEXT` has **`role: null`**.
- `can()` **fails closed**: `null` or an unknown role answers **`false`**.
- The gate **renders nothing while `role` is `null`**, so the user never sees an action they might
  not be allowed to take.

This is the correct failure direction: an unresolved role produces an empty UI, not an optimistic
one.

## Boundary: caller with no membership at all

If a user reaches an organization route without belonging to the organization:

- **Backend**: uniform `404`. Indistinguishable from a nonexistent organization.
- **Frontend**: the `not-found` view, offering "Go to Personal".
- **No partial access.** There is no read-only mode for non-members and no "request access" flow -
  joining is not built (#82).

## Boundary: personal data and organization membership

A user who owns personal records **and** belongs to organizations is the documented case where the
boundaries must hold:

- **Personal data is owner-only.** It is never visible to organization members - not even members of
  an organization the owner belongs to.
- It is never visible to the global `is_admin`.
- Organization data is visible to every member of that organization, regardless of who created it.
- The two sets are **disjoint**: a personal query can never return an organization record, and an
  organization query can never return a personal one. An organization record has `user_id` `NULL`,
  which is what makes the personal query structurally unable to match it.

## Boundary: organization with a single member

Every organization has exactly **one** member today - its owner - because **there is no way to
join**.

What that implies:

- Member management has never been exercised. Invites, role changes, leave and transfer are all
  **unbuilt** (#82).
- The minimal response shape has never had to hide a real member list, because there is none to
  hide. The shape was still designed for the future state - see [Response](./response.md).
- The `owner` role's exclusivity has never been tested against a real second member. The only
  `owner` row is the one written by `create`.

## Boundary: organization data outliving the creator

- Organization data **belongs to the organization** and **outlives its creator's membership or
  account status**.
- Consequence: closing an organization (#83) is not a simple delete. Memberships reference it with
  `ON DELETE RESTRICT`, so they must be resolved first.
- A user who created an organization and is later denied keeps a membership they cannot use, and
  the organization keeps data no reachable member can see.

## Cases that do not exist

Listed because their absence is a decision, not an omission.

| Case | Status |
|---|---|
| Joining an organization | **Not built** (#82) |
| Listing the members of an organization | **No endpoint exists.** Not even the owner can enumerate members |
| Leaving an organization | **Not built** (#82) |
| Transferring ownership | **Not built** (#82) |
| Closing / deleting an organization | **Not built** (#83). `ON DELETE RESTRICT` blocks it |
| Changing a member's role | **Not built** (#82) |
| Inviting a user by email | **Not built** (#82) |
| Rate-limiting creation | **Not built** (#84) |
| Moving a record between owners | **Not built** (#93) |
| Sharing a personal record with an organization | **Not built** (#94) |
| Authorship / audit trail | **Not built** (#95). There is no `created_by` column |
| An owner-only action | **None exists.** Every action an owner can take, an `admin` can too |

## What is not documented in the repository

The `docs/agents/` pages state the edge cases above, with the outcomes described. They do **not**
contain:

- the behaviour when a **denied** user still holds the `owner` membership of an organization and
  the organization's data - the docs state data outlives access, and do not describe any cleanup;
- whether an organization whose sole owner is denied is intended to be recoverable, and by whom;
- the behaviour of `GET /orgs.json` for a user with a very large number of organizations - no
  pagination is documented, but no limit is either;
- what happens to a **remembered context** when the same id is later reused by a different
  organization - the storage holds an id, and no reuse policy is documented;
- whether two concurrent `PATCH` calls can produce a name that is neither of the two submitted -
  only "last write wins" is stated;
- the exact UI behaviour when `refreshOrgs` fails during a `403`-triggered refresh;
- any migration path for the "#28 auto-creates an organization at registration" behaviour, which
  was reversed before being built.

Read `docs/agents/modules/auth/organizations.md` and
`docs/agents/architecture/frontend.md` for the authoritative version. Nothing on this page is
inferred beyond what the docs state.
