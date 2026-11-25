# Organizations - Roles

Hub: [Organizations](README.md).

## Summary

Three roles, ranked, enforced at three separate points.

| Role | Rank | Grants |
|---|---|---|
| `owner` | 3 | Everything `admin` can do. Held by the organization's creator |
| `admin` | 2 | Destructive and structural writes |
| `user` | 1 | Reads, and everyday writes |

- Ranking: `user` < `admin` < `owner`. A role allows everything a lower one allows.
- **Reads need only membership** - every `GET` is open to `user`.
- **No action is owner-only today.** Every action an `owner` can take, an `admin` can take too.
- The role is **never taken from input** and is re-read from the database on every request.

Epic #81, delivered by #143 (backend) and #144 (frontend).

## The capability split

| Capability | Minimum role |
|---|---|
| Read anything in the organization | `user` (membership) |
| Create and edit transactions | `user` |
| Create and edit bills and provider bills | `user` |
| Pay or skip an occurrence | `user` |
| Mark accountant rows as sent or unsent | `user` |
| Undo a payment | `admin` |
| Edit a payment-generated transaction | `admin` |
| Manage the account structure - create, edit, archive, unarchive, delete | `admin` |
| Delete a record | `admin` |
| Rename the organization | `admin` |

The dividing line: **everyday data entry is `user`; anything destructive or structural is `admin`.**

## The three enforcement points

The same matrix is enforced three times, at three layers, and the layers must agree.

### 1. The guard - `@MinOrgRole()`

Declared on a route, read by `OwnerContextGuard`.

- The route declares its minimum role as metadata.
- The guard resolves the membership, then compares via `hasMinRole(membership.role, min)`.
- A failure answers the **uniform 403**.
- This is the mechanism for owner-scoped modules such as `bank`.

### 2. The service - the rename check

The four organization routes are **not** owner-scoped, so `@MinOrgRole()` does not apply to them.
`OrganizationService.rename` performs the check itself:

```
hasMinRole(membership.role, ADMIN)
```

- The membership is loaded inside the service, not supplied by the caller.
- A failure raises `orgRoleForbidden()` - the same uniform 403 body.
- `create` needs no check: any approved user may create an organization, and becomes `owner`.

### 3. The frontend - `can(role, action)`

`utils/permissions/orgPermissions.js` mirrors the matrix.

| Action | Minimum role |
|---|---|
| `WRITE` | `user` |
| `UNDO_PAYMENT` | `admin` |
| `EDIT_PAYMENT_TRANSACTION` | `admin` |
| `MANAGE_ACCOUNTS` | `admin` |
| `RENAME_ORGANIZATION` | `admin` |
| `DELETE` | `admin` |

- **It fails closed**: an unknown or `null` role, or an unknown action, answers `false`.
- `role` comes from the org list, so there is no separate role request.
- The UI **hides** what the role cannot do. **Hidden controls are not a security boundary** - every
  one of those actions is refused by the backend.

## Where the role comes from

| Rule | Detail |
|---|---|
| Source | `OrganizationMembership.role`, read through `findRole(userId, orgId)` |
| Cache | **None.** Re-read from the DB on every request |
| Input | **Never.** No body, query param or header carries a role |
| Default | None. `create` writes `owner` explicitly; nothing else writes a role |
| Personal context | `ownerRole(ctx)` returns **`owner`**, so `can()` needs no personal branch |

The last row is why the personal context needs no special case anywhere in the permission code: the
JWT user is treated as `owner` of their own data.

## The global admin is not an organization role

Two different concepts that are constantly confused:

| Concept | Scope | Grants organization access |
|---|---|---|
| `owner` / `admin` / `user` | One organization | Yes, to that organization |
| Global admin (`is_admin` on the user) | The platform | **No** |

Consequences:

- A global admin who is **not a member** gets the same uniform **`404`** as anyone else.
- There is **no `is_admin` bypass** anywhere in the organization path.
- `AdminGuard` / `@AdminOnly()` govern the admin routes and are unrelated to this matrix.
- Being an organization `owner` grants nothing outside that organization.

## The 404-before-403 rule

The check order is part of the security contract, not an implementation detail.

```
1. Is the caller a member?          no  -> uniform 404
2. Does the role meet the minimum?  no  -> uniform 403
3. Proceed
```

Consequences:

- A **non-member never receives a `403`.** A `403` therefore never reveals that the organization
  exists.
- The `403` body names **neither the resource nor the required role**. It is always
  `FORBIDDEN` / `Forbidden`.
- On `PATCH /orgs/:orgId.json` the full order is **`400` > `404` > `403`**: the body is validated
  first, so an invalid body answers `400` even for an unknown organization.

## The "exactly one owner" invariant

The `owner` role is special only in that `create` writes it. It is **not** protected by the schema.

- There is **no partial unique index** on `role = 'owner'`.
- The invariant holds because `OrganizationService#create` is the **only** writer of memberships.
- It always writes exactly one `owner` row, in the same transaction as the organization.
- Any second writer - invite, join, transfer, role change - must preserve it in its own transaction.

Nothing in the database will catch a violation. See [Service](./service.md) and
[Roadmap](./roadmap.md).

## Role changes mid-session

| Layer | Behaviour |
|---|---|
| Backend | Immediate. The role is re-read per request, so a change on the next request is already in effect |
| Frontend | On the next `403`. The UI holds a copy from `GET /orgs.json`; `ApiClient` emits `permission:forbidden`, and `forbiddenRefreshEffect` refetches once per burst |

Visible sequence for a demoted admin: controls still shown, click one, backend answers `403`, UI
refreshes the role, controls disappear. Until that `403`, the UI may still offer actions the backend
will refuse - that is UX lag, not a security hole.

## Adding an action

When a new capability arrives, four places must change together:

1. **Backend route** - `@MinOrgRole(role)` if the controller is owner-scoped, or an explicit
   `hasMinRole` check in the service otherwise.
2. **Backend matrix documentation** - the capability table above.
3. **Frontend `ACTIONS`** - a new constant, with its minimum role.
4. **Frontend gating** - `useCan(action)` at the control, so the button hides for the roles that
   cannot use it.

Missing step 4 shows a control the API refuses. Missing step 1 or 2 is a security hole. A
divergence between the backend matrix and `orgPermissions.js` is invisible until someone clicks.

## What is not documented in the repository

The project documentation states the three values, the ranking, the capability split, the three
enforcement points and the 404/403 order. It does **not** contain:

- the **full capability list per route** - the canonical matrix lives in `backend/routes/bank.md`
  under "minimum role", which is outside the organizations documents;
- the TypeScript declaration of `OrgRole`, beyond the three string values;
- whether `hasMinRole` treats an unknown role as the lowest or fails hard - the docs state that
  `can()` on the frontend fails closed, not what the backend does for an unexpected value;
- whether new values could be added without a migration;
- any owner-only action, because none exists today.

Read `backend/src/core/org-role.ts` and `backend/src/auth/organization.service.ts` for the
authoritative version. Nothing on this page is inferred beyond what the docs state.
