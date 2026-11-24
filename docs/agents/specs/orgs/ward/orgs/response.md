# Organizations - Response

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Endpoints](./endpoints.md), [Security](./security.md), [Caching](./caching.md),
[Models](./models.md).

## Summary

Every organization route serializes through **one** module:
`backend/src/auth/organization-response.ts`.

The shape is fixed and minimal:

```
{ id, name, role, created_at, updated_at }
```

- `role` is **the caller's** role in that organization - not the owner's role.
- **Nothing else is ever returned.** No member list, no member count, no other users' ids, no
  membership ids.
- The same shape is used by **all four routes**, success responses included: list, create, read
  one, rename.

## The serializer

| Property | Value |
|---|---|
| File | `backend/src/auth/organization-response.ts` |
| Role | Organization serializer |
| Input | An `Organization` plus the caller's role in it |
| Output | `{ id, name, role, created_at, updated_at }` |
| Used by | `OrganizationController`, on all four routes |

The serializer exists so that the **entity is never sent directly**. `Organization` and
`OrganizationMembership` are internal types; the API only ever exposes the shape above.

## The shape, field by field

| Field | Source | Notes |
|---|---|---|
| `id` | `Organization.id` | Integer primary key. Safe to expose: the caller is already a member, and a foreign id answers the uniform `404` |
| `name` | `Organization.name` | Already trimmed and validated on write. Always rendered escaped (React text, never HTML). **Never logged** |
| `role` | The **caller's** membership role | One of `owner`, `admin`, `user`. See below |
| `created_at` | `Organization.created_at` | Timestamp |
| `updated_at` | `Organization.updated_at` | Timestamp |

That is the complete field set. There is no `description`, no `member_count`, no `owner_id`, no
`slug`, no `members`.

## `role` is the caller's role

This is the one field that is **not** a straight copy from the organization row.

- The value describes **the caller's membership**, not the organization.
- Consequence: **the same organization serializes differently for two different callers** - a
  member at `user` level receives `role: "user"`, an admin receives `role: "admin"`.
- This is why an organization response is **never cacheable by path** even though the id is in the
  URL: two callers asking for the same `/orgs/:orgId.json` must receive different `role` values.
  See [Caching](./caching.md).

### Per route

| Route | What `role` holds |
|---|---|
| `GET /orgs.json` | Each item carries the caller's role **in that specific organization** - values may differ between items |
| `POST /orgs.json` | Always `"owner"` - the caller just created it, and creation hard-codes the `owner` role |
| `GET /orgs/:orgId.json` | The caller's role in that organization |
| `PATCH /orgs/:orgId.json` | The caller's role in that organization; unchanged by the rename |

A user may therefore receive `owner` for one organization and `user` for another **in the same
list response**. Today that cannot happen in practice - there is no way to join, so the only
membership a user ever has is the one they created - but the shape is already the one that stays
correct when joining exists.

## What is never exposed

The list matters more than the fields present, because these are the leaks a multi-tenant API
usually has.

| Never exposed | Why |
|---|---|
| **Member list** | No endpoint returns it, and no response embeds it. Even the owner cannot enumerate the members through this API |
| **Other users' ids** | A member's `user_id` is never serialized, so belonging to an organization cannot be discovered from a response |
| **Membership ids** | `OrganizationMembership.id` is internal; it is never a public identifier |
| **`organization_id` on domain records** | For user-or-organization-owned modules, records never expose owner fields - not `user_id`, not `organization_id` |
| **`is_admin`** | The caller's global platform role is not part of an organization response |
| **Member count** | Not present. A count would leak the size of an organization the caller may only partially know |
| **Owner identity** | The response says the caller's role, never who owns the organization. There is deliberately no `owner` field |
| **Organization settings or metadata** | None exist to expose - the entity is only `id`, `name`, timestamps |

Two of these deserve emphasis:

- **The absence of an owner field is not an oversight.** The database has no owner column either;
  ownership lives only in the membership role. See [Models](./models.md).
- **The absence of a member list is a security property, not a missing feature.** Adding one to
  this response would turn four routes into an enumeration surface. If member management arrives
  (#82), it should come as a dedicated endpoint with its own authorization, not as an extra field
  here.

## Why the shape is minimal

The design intent, as documented: organization routes return **only** `id`, `name`, the caller's
`role` and timestamps; never member lists or other users' ids.

Three reasons that hold together:

1. **Enumeration resistance.** A response body that carries other users' ids or a member count
   tells an attacker something about an organization they may not fully know. A body carrying only
   the caller's own relationship tells them nothing they did not already have.
2. **Cache safety.** The response is caller-dependent (the `role` field) and owner-free. That
   combination is what makes `user-scoped` caching correct rather than merely conservative.
3. **Stability under new features.** The shape stays safe whether or not joining exists. Today it
   is trivially safe because every organization has one member; the choice was made for the future
   state, not the current one.

## Consistency across routes

- **One serializer, one shape.** List, create, read and rename all return the same object shape.
- **The list route returns an array of that shape** - not a wrapper object, and not a paginated
  envelope.
- **Zero organizations returns `[]`** - an empty array, not `null` and not a `404`. This is the
  normal state for a new user.
- A client can therefore deserialize every organization response with a single type, which is what
  the frontend does.

## Boundary with the error bodies

Success responses and error responses are separate concerns:

- **Success** - the minimal shape above, serialized by `organization-response.ts`.
- **Errors** - the uniform `400` / `403` / `404` / `401` bodies, produced elsewhere. See
  [Security](./security.md).

The serializer is **not** involved in an error path: a `404` never carries a partial organization,
and a `403` never carries one either. Nothing about the organization leaks through a failure
response.

## Relation to the user serializer

A useful contrast, documented in the auth routes: the `user` object returned by login, register and
refresh is `{ id, username, email, isAdmin }`, and **`passwordDigest` and the account `status` are
never serialized**.

The same discipline applies here at a different scale:

| Object | Always present | Never serialized |
|---|---|---|
| `user` | `id`, `username`, `email`, `isAdmin` | `passwordDigest`, `status` |
| organization | `id`, `name`, `role`, `created_at`, `updated_at` | members, member ids, owner, membership ids |

Neither serializer uses a generic entity-to-JSON conversion. Both are explicit allowlists of
fields, which is why a new column on either entity does not silently become public.

## Adding a field - the rule that follows

Because the serializer is an allowlist, adding a column to `Organization` does **not** expose it.
That is the intended behaviour: a new field becomes public only when someone edits
`organization-response.ts`.

Before doing so, the questions the docs imply:

1. **Is it caller-dependent?** If yes, the cache class must remain `user-scoped` - it already does.
2. **Does it reveal another user?** Any member id, member count or owner identity would open the
   enumeration surface described above.
3. **Does it reveal internal structure?** Membership ids and foreign keys are not public
   identifiers.
4. **Would it be better as its own endpoint?** Member management, if it arrives, belongs to a
   dedicated route with its own authorization - not to this shape.

## What is not documented in the repository

The `docs/agents/` pages state the serializer's file, its purpose and the exact output shape. They
do **not** contain:

- the source of `organization-response.ts`: the function name and signature, whether it takes the
  entity plus a role or a composed object, and whether it returns a class instance or a plain
  object;
- whether the timestamps are serialized as ISO 8601 strings or in another format;
- whether `created_at` / `updated_at` are omitted on any route;
- whether the serializer is shared with any other module's response builder;
- the corresponding TypeScript type or DTO that describes the response on the client side;
- whether the list route wraps its array in any envelope at all - the docs describe an "array of
  organizations", which this page follows literally.

Read `backend/src/auth/organization-response.ts` for the authoritative version. Nothing on this page
is inferred beyond what the docs state.
