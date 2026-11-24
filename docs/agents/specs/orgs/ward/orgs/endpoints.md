# Organizations - Endpoints

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Security](./security.md), [Response](./response.md), [Caching](./caching.md),
[Roles](./roles.md), [Service](./service.md), [Examples](./examples.md).

## Summary

Four routes, all JWT-protected, served by **`OrganizationController`**
(`backend/src/auth/organization.controller.ts`), which delegates to `OrganizationService`.

| Method | Path | Purpose | Success | Cache class |
|---|---|---|---|---|
| `GET` | `/orgs.json` | List the organizations the caller belongs to | `200` | `user-scoped` |
| `POST` | `/orgs.json` | Create an organization; the caller becomes `owner` | `201` | `never` |
| `GET` | `/orgs/:orgId.json` | Read one organization, with the caller's role | `200` | `user-scoped` |
| `PATCH` | `/orgs/:orgId.json` | Rename an organization | `200` | `never` |

There is no `DELETE /orgs/:orgId.json`. Closing an organization is documented target behaviour,
not built - see [Roadmap](./roadmap.md).

## Path prefix

- **The backend has no `/api` prefix.** The routes are `/orgs.json` and `/orgs/:orgId.json`, served
  by a controller with **no prefix**.
- The **proxy** (`darthjee/tent`) adds the external `/api` prefix, so a browser calls
  `/api/orgs.json`.
- The routes are **not** under `/auth/`. `OrganizationController` is a third controller in the
  `auth` module, separate from `AuthController` and `AuthorizationRequestController`.

## Shared behavior

These rules apply to all four routes, so they are stated once.

### Authentication

- **JWT-protected.** None of the four carries `@Public()`, so `JwtGuard`'s session-lookup gate
  applies.
- Only **approved** users are authenticated. A `pending` user's access tokens are blocked by the
  gate; a `denied` user cannot log in at all.
- Every gate rejection answers the same `401` body (see [Security](./security.md)).

### Body

- Bodies come **only through `@StrictBody()`**, typed by `OrganizationNameDto`.
- The DTO accepts **`name` only**, and it is **required**.
- Any other field - `role`, `organizationId`, `userId`, anything - answers
  **`400 VALIDATION_FAILED`**.
- The name is **trimmed**, then must be non-empty, at most **255 code points** and free of control
  characters (Unicode `Cc`).
- This is why "no client-supplied owner or role" holds at the transport layer: the role is never
  an input, and the organization always comes from the URL.

### `:orgId`

- Taken as a **raw string** and parsed by `parseOrgId()` (`core/parse-org-id.ts`). A raw string is
  deliberate: with a numeric coercion, `1e3` would become `1000`.
- **Every** resolution failure - unknown id, malformed id, non-numeric id, or not a member - answers
  the **same uniform `404`**. A global admin who is not a member gets it too.
- The `404` **always** runs before any role check.

### Roles

| Route | Minimum role |
|---|---|
| `GET /orgs.json` | none - any member |
| `POST /orgs.json` | none - any approved user; the caller becomes `owner` |
| `GET /orgs/:orgId.json` | none - any member |
| `PATCH /orgs/:orgId.json` | `admin` or `owner` |

- **Both `GET`s are open to every member** - reads need membership, not a minimum role.
- A member whose role is too low answers the **uniform `403`**, only after the membership check.
- The role check for `PATCH` lives in **`OrganizationService.rename`**, not in `@MinOrgRole`, because
  these routes are **not** owner-scoped. See [Roles](./roles.md).

### Response shape

- Every organization is serialized as `{ id, name, role, created_at, updated_at }`.
- **`role` is the caller's role** in that organization, not the owner's role.
- Member lists and other users' ids are **never** returned.
- Serialization is done by `organization-response.ts` - see [Response](./response.md).

### Cache

- The controller declares **`never`** at class level, so every route sends
  **`X-Skip-Cache: true`**.
- The two `GET`s are **narrowed to `user-scoped`**, cached per caller.
- An organization id in the URL does **not** make a response public.
- **Names are never logged.**
- See [Caching](./caching.md).

## `GET /orgs.json`

| Property | Value |
|---|---|
| Controller | `OrganizationController` |
| Auth | JWT (approved user) |
| Request body | - |
| Query parameters | **none documented** |
| Success response | Array of organizations the caller belongs to |
| Ordering | **By id** |
| HTTP status | `200` |
| Cache class | `user-scoped` |

- Returns **every** organization the caller is a member of - and, today, a user is only ever a
  member of organizations they created.
- **Zero organizations returns an empty array**, not a `404`. This is the normal state for a new
  user.
- **No filtering, no pagination, no search, no sort parameter** is documented for this route. The
  response is the full membership list, ordered by id.
- This is the route the UI's **context switcher** is built on.

## `POST /orgs.json`

| Property | Value |
|---|---|
| Controller | `OrganizationController` |
| Auth | JWT (approved user) |
| Request body | `OrganizationNameDto` - `{ name: string }` |
| Success response | The created organization, with `role: "owner"` |
| HTTP status | `201` |
| Errors | `400 VALIDATION_FAILED` |
| Cache class | `never` |

- Creates the organization **and the caller's `owner` membership in one DB transaction**.
- The **role is never taken from input**: it is hard-coded to `owner` for the creator.
- This is the **only** route that writes a membership, which is what makes the "exactly one owner"
  invariant hold without a database constraint. See [Service](./service.md).
- There is **no join mechanism**: no invite, no member addition. This route always creates a
  single-member organization.
- Rate limiting is documented target behaviour, not built (#84).

### Validation failure cases

All of them answer `400 VALIDATION_FAILED`:

| Case |
|---|
| `name` missing |
| `name` empty or whitespace-only after trimming |
| `name` longer than 255 code points |
| `name` containing a control character (Unicode `Cc`) |
| Any field other than `name` present - `role`, `organizationId`, etc. |

## `GET /orgs/:orgId.json`

| Property | Value |
|---|---|
| Controller | `OrganizationController` |
| Auth | JWT (approved user) |
| Request body | - |
| Query parameters | **none documented** |
| Success response | The organization, with the caller's role |
| HTTP status | `200` |
| Errors | uniform `404` - unknown, malformed, or non-member |
| Cache class | `user-scoped` |

- Resolves `:orgId` with `parseOrgId()`, then checks the caller's membership.
- A member of the organization reads it regardless of role - `user` is enough.
- The **uniform `404`** covers every failure, including a global admin who is not a member.

## `PATCH /orgs/:orgId.json`

| Property | Value |
|---|---|
| Controller | `OrganizationController` |
| Auth | JWT, **`admin` or `owner`** |
| Request body | `OrganizationNameDto` - `{ name: string }` |
| Success response | The renamed organization, with the caller's role |
| HTTP status | `200` |
| Errors | `400 VALIDATION_FAILED`; uniform `404`; uniform `403` (role `user`) |
| Cache class | `never` |

### Check order - significant

The three checks run in this exact sequence:

1. **`400` - body.** Validated first, by the DTO / `@StrictBody()`.
2. **`404` - membership.** `:orgId` parsed, membership looked up.
3. **`403` - role.** Checked inside `OrganizationService.rename` via
   `hasMinRole(membership.role, ADMIN)`.

Two consequences, both deliberate:

- An invalid body answers **`400` even for an unknown or foreign organization**, because the body
  is validated before `:orgId` is resolved. That `400` depends **only on the body**, so it cannot
  be used to enumerate organizations.
- The `404` **always** precedes the `403`, so a non-member never learns that an organization
  exists.

### Rename semantics

- **Only the name changes.** No other field exists to update.
- **Concurrent renames: last write wins.** There is no optimistic locking, no version column and no
  `If-Match`.
- **Names are never logged**, on this path or any other.
- Renaming is the **only** organization-level write besides creation. There is no delete.

## Error bodies

The three error families, as documented. The full bodies are in [Security](./security.md).

### `400 VALIDATION_FAILED`

Returned when the body carries an unknown field, a missing/empty `name`, a name over 255 code
points, or a control character.

### `404` - uniform

```json
{
  "error": { "code": "NOT_FOUND", "message": "Not Found" },
  "statusCode": 404,
  "timestamp": "<ISO 8601>"
}
```

Used for: unknown `:orgId`, malformed `:orgId`, non-numeric `:orgId`, and non-member - a global
admin included.

### `403` - uniform

```json
{
  "error": { "code": "FORBIDDEN", "message": "Forbidden" },
  "statusCode": 403,
  "timestamp": "<ISO 8601>"
}
```

Used for every role failure. It names **neither the resource nor the required role**, and it is
only ever reached by a **member**.

## Filters and query parameters

**None are documented, on any of the four routes.** Stated explicitly because the absence is
meaningful:

| Capability | Status on these routes |
|---|---|
| Pagination (`page`, `limit`, `offset`, `cursor`) | Not documented; the list route returns the full membership list |
| Sorting | Not documented; the order is fixed **by id** |
| Search by name | Not documented; `name` is not unique and has no index |
| Filter by role | Not documented; `role` is per-organization and returned per row |
| Partial response / field selection | Not documented |
| ETag / conditional requests | Not documented |

A reader looking for a filter on this endpoint set is looking for something that does not exist.
The only selection dimension is **the caller's memberships**: `GET /orgs.json` returns exactly
what the caller belongs to, and nothing else is queryable.

## What is not documented in the repository

The `docs/agents/` pages document the four routes, their payloads, statuses, errors, role rules,
check order, response shape and cache class. They do **not** contain:

- the exact controller source: the decorator list per method, the method signatures and the return
  types;
- the full `OrganizationNameDto` definition beyond "`name` only, required, trimmed, 255 code
  points, no control characters";
- the exact `400 VALIDATION_FAILED` body - the docs name the code but do not quote the shape;
- whether the `201` on create is declared explicitly or is the framework default;
- whether any response carries pagination or total-count headers;
- the OpenAPI/Swagger surface, if one exists;
- the `X-Cache-Allow` value sent on the two `GET`s.

Read `backend/src/auth/organization.controller.ts` and
`backend/src/auth/dto/organization-name.dto.ts` for the authoritative version. Nothing on this page
is inferred beyond what the docs state.
