# Organizations - Response

Hub: [Organizations](../orgs.md).

## Summary

Every organization response has **exactly five fields**, on all four routes:

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Primary key |
| `name` | string | Trimmed and validated on write; escaped on render |
| `role` | `owner` \| `admin` \| `user` | **The caller's** role, not the owner's |
| `created_at` | timestamp | Set on insert |
| `updated_at` | timestamp | Moved on every write |

That is the whole contract. The list route returns an **array of this shape**, bare, with no
envelope. There is no second shape anywhere - not for read, not for create, not for rename.

## The serializer is an allowlist

`backend/src/auth/organization-response.ts` builds the object **explicitly**, field by field.

```
serialize(organization, role) -> {
  id:         organization.id,
  name:       organization.name,
  role,                                  // the caller's, passed in
  created_at: organization.created_at,
  updated_at: organization.updated_at,
}
```

The consequences of that approach versus spreading the entity:

| Approach | Effect of a new column |
|---|---|
| **Allowlist** (what this uses) | Adding a column does **not** change the response. Publishing it requires an explicit edit |
| Spread (`{...organization}`) | Every new column is published automatically, including one that should stay private |

A `created_by` column (#95), a `slug`, an `owner_id`, a `deleted_at` - all would be private by
default. That is the reason the serializer is written this way.

## Why `role` is the caller's

This is the single most misread part of the shape.

| Reading | Result |
|---|---|
| "`role` is the organization's owner role" | **Wrong.** There is no owner-role field |
| "`role` is my role in this organization" | Correct |

Consequences:

- **The same URL returns different bodies to different callers.** `GET /orgs/1.json` as the `owner`
  and as a `user` produce the same `id`, `name` and timestamps, but different `role`.
- **The response carries no owner identity.** Who holds `owner` is never disclosed.
- The list route may return **different `role` values per item** for the same caller.

Because the body depends on the caller, the cache class is `user-scoped` and **never** `public`.
See [Caching](./caching.md).

Today every item has `role: "owner"`, because joining is not built (#82). A `user` or `admin` value
becomes reachable when a second member can exist.

## What is never in a response

| Never present | Why |
|---|---|
| A member list | No endpoint exists, and the serializer has no field for it. Adding `members` here would turn four routes into an enumeration surface |
| A member count | Not stored, not computed |
| The `owner`'s identity | The caller's role is shown; who owns the organization is not |
| Another user's `id` | The response carries no user reference at all |
| `ownerId`, `owner_id` | Neither exists on the model |
| `created_by` | Does not exist (#95) |
| Membership ids | Internal to the join |
| `is_admin` | A platform flag, unrelated to this domain |
| Settings, descriptions, metadata | Do not exist on the model |

The **absence of a member list** is a deliberate asymmetry: it is the reason the response can be
five fields instead of a nested object, and the reason the four routes are not an enumeration
surface.

## The organization response

```
{
  "id": 1,
  "name": "Acme",
  "role": "owner",
  "created_at": "2026-11-01T09:12:44.000Z",
  "updated_at": "2026-11-01T09:12:44.000Z"
}
```

Type-level:

```
interface OrganizationResponse {
  id: number
  name: string
  role: OrgRole
  created_at: Date | string
  updated_at: Date | string
}
```

Whether the timestamps are serialized as strings or numbers is not documented. See the final section.

## The list response

```
[
  { "id": 1, "name": "Acme",     "role": "owner", "created_at": "...", "updated_at": "..." },
  { "id": 4, "name": "Northwind","role": "admin", "created_at": "...", "updated_at": "..." }
]
```

| Property | Detail |
|---|---|
| Envelope | **None** - the array is bare |
| Pagination metadata | **None** |
| Order | By organization `id` |
| Empty | `[]` with `200` |
| Per-item role | The caller's role in that organization |

There is no `{ "organizations": [...] }` wrapper and no `{ data, total }` shape. A client consumes
the array directly.

The **bare array** is worth noting because it blocks a future addition: adding pagination metadata
later would be a breaking change. That is a documented consequence of the current contract, not an
oversight.

## Error bodies

Errors do **not** use the organization shape. They use the platform's standard body:

```
{
  "error": { "code": "NOT_FOUND", "message": "Not Found" },
  "statusCode": 404,
  "timestamp": "2026-11-24T11:32:41.902Z"
}
```

| Status | `code` | `message` |
|---|---|---|
| `400` | `VALIDATION_FAILED` | `Validation failed` (reconstructed - see Examples) |
| `401` | `UNAUTHORIZED` | `Invalid or expired access token`, or `Missing access token` |
| `403` | `FORBIDDEN` | `Forbidden` |
| `404` | `NOT_FOUND` | `Not Found` |

The `403` and `404` messages name **neither the resource nor the role**. That is the security
property: a client cannot distinguish which organization failed or which role was required.

Concrete payloads: [Examples](./examples.md).

## Rendering rules

| Rule | Detail |
|---|---|
| `name` as text | Always rendered as React text, never as HTML |
| No `dangerouslySetInnerHTML` | On any field |
| Escaping | A name containing `<script>` is displayed literally |
| Truncation | The context switcher truncates long names visually; the API returns the full name |

## Consistency guarantees

What a client may rely on:

| Guarantee | Detail |
|---|---|
| Same shape everywhere | The five fields, on all four routes |
| `role` always present | Never omitted, never `null` for a member |
| `id` stable | Never reused, never reassigned |
| `updated_at` moves on write | Create and rename both set it |
| `created_at` never changes | Set once at insert |

What a client must **not** rely on:

| Not guaranteed | Why |
|---|---|
| The set of fields growing | The allowlist only changes deliberately |
| A `name` being unique | Duplicates are legal |
| An organization always visible | Membership can be lost; the caller then gets `404` |
| `role` staying constant | A role change applies on the next request |
| Timestamp precision | The format is not documented |

## Adding a field

If a new field must become public, three places change together:

1. **The model** - the column must exist (or be derived).
2. **`organization-response.ts`** - add it to the allowlist. Without this, nothing is published.
3. **This page and [Examples](./examples.md)** - the documented shape.

Step 2 is the gate. A column added to the entity without touching the serializer stays private,
which is the intended direction of failure.

Before adding anything, check whether it belongs in a **dedicated endpoint** instead. A member list,
for example, should not become a nested field here - it would turn the four routes into an
enumeration surface. That is why #82 is expected to add an endpoint rather than a field.

## What is not documented in the repository

The project documentation states the five fields, the allowlist approach, the per-caller `role`, and
the standard error body. It does **not** contain:

- the **source** of `organization-response.ts`;
- whether `created_at` / `updated_at` are serialized as ISO strings, epoch numbers, or left as `Date`
  objects for the framework to convert;
- the exact timestamp precision, and whether a `Z` suffix is always present;
- whether the serializer is a plain function, a class, or a TypeORM transformation;
- whether `role` is typed as `OrgRole` or as a plain `string` in the response interface;
- whether any response includes an ETag or a version identifier;
- whether the list is serialized item by item through the same function, or through a separate path.

Read `backend/src/auth/organization-response.ts` and
`backend/src/auth/tests/organization-response.spec.ts` for the authoritative version. Nothing on
this page is inferred beyond what the docs state.
