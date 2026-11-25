# Organizations - Examples

Hub: [Organizations](../orgs.md).

Concrete requests and responses for the four organization routes.

## Summary

| Route | Success | Main failures |
|---|---|---|
| `GET /orgs.json` | `200` array | `401` |
| `POST /orgs.json` | `201` object | `400`, `401` |
| `GET /orgs/:orgId.json` | `200` object | `401`, `404` |
| `PATCH /orgs/:orgId.json` | `200` object | `400`, `401`, `403`, `404` |

## About these examples

Two kinds of content appear below, and they are labelled differently.

**Transcribed** - quoted from the project documentation, verbatim: the `401`, `403` and `404` bodies,
the response field set, the status codes, and the check order.

**Reconstructed** - built to illustrate the documented contract where the docs state the rule but do
not quote the payload. These appear with a note. The `400 VALIDATION_FAILED` body and the request
examples are in this group: the docs name the code and the validation rules, they do not print the
JSON. Verify against the running API before relying on the exact shape.

## Conventions

- **No `/api` in the backend.** The routes are `/orgs.json` and `/orgs/:orgId.json`. The proxy adds
  the external `/api` prefix, so a browser calls `/api/orgs.json`.
- **Authentication is a cookie**: `access_token`, `httpOnly`, `secure`, `sameSite: 'strict'`,
  `maxAge` = `WARD_ACCESS_TOKEN_TTL_MS` (default 15 minutes). It is **never** in a response body.
- **All dates** are ISO 8601 timestamps. Timestamps below are illustrative.
- **`timestamp`** in an error body is an ISO 8601 string, different on every response.
- Every organization response carries exactly **five fields**: `id`, `name`, `role`, `created_at`,
  `updated_at`.

## `GET /orgs.json`

### Request

```
GET /api/orgs.json
Cookie: access_token=<jwt>
```

No body, no query parameters.

### Success - two organizations

```json
[
  {
    "id": 1,
    "name": "Acme",
    "role": "owner",
    "created_at": "2026-11-01T09:12:44.000Z",
    "updated_at": "2026-11-01T09:12:44.000Z"
  },
  {
    "id": 4,
    "name": "Northwind",
    "role": "admin",
    "created_at": "2026-11-03T14:02:10.000Z",
    "updated_at": "2026-11-03T14:02:10.000Z"
  }
]
```

- **Ordered by `id`.**
- **`role` is the caller's role in each organization** - values may differ between items. Today a
  user only ever holds `owner`, because joining is not built; a `user` or `admin` value would come
  from #82.
- The array is returned **bare**: no `{ organizations: [...] }` envelope and no pagination
  metadata.

### Success - zero organizations

```json
[]
```

This is the **normal state** for a new user. It is a `200` with an empty array, not a `404` and not
`null`.

### Failure - not authenticated

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired access token" },
  "statusCode": 401,
  "timestamp": "2026-11-24T11:30:02.114Z"
}
```

- **Transcribed.** Every gate rejection answers this same body, byte-for-byte apart from
  `timestamp`: bad signature, expired token, malformed claims, token without `sid`, revoked or
  expired session, session of another user, or a `pending` / `denied` user.
- A **missing** cookie answers a different message: `401 Missing access token`.

## `POST /orgs.json`

### Request

```
POST /api/orgs.json
Cookie: access_token=<jwt>
Content-Type: application/json

{ "name": "Acme" }
```

The body accepts **`name` only**, and it is **required**. The name is trimmed, must be non-empty,
at most **255 code points**, and free of control characters (Unicode `Cc`).

### Success

```json
{
  "id": 1,
  "name": "Acme",
  "role": "owner",
  "created_at": "2026-11-24T11:31:08.000Z",
  "updated_at": "2026-11-24T11:31:08.000Z"
}
```

- Status **`201`** - the only `201` among the four routes.
- **`role` is always `"owner"`**: the caller is the creator, and `create` hard-codes the role. It is
  never read from input.
- The organization and the caller's `owner` membership are written in **one DB transaction**, so a
  failure leaves no orphan organization.
- There is **no cap and no dedupe**: posting the same name twice creates two organizations.

### Failure - unknown field

Request:

```json
{ "name": "Acme", "role": "owner" }
```

Response - **reconstructed**, the docs name the code but do not quote the body:

```json
{
  "error": { "code": "VALIDATION_FAILED", "message": "Validation failed" },
  "statusCode": 400,
  "timestamp": "2026-11-24T11:31:08.114Z"
}
```

- `@StrictBody()` rejects **any** unknown field, including `role`, `organizationId` and `userId`.
- This is the mechanism that makes "no client-supplied owner or role" true at the transport layer.

### Failure - invalid name

All of these answer the same `400 VALIDATION_FAILED`:

| Request body | Reason |
|---|---|
| `{}` | `name` missing |
| `{ "name": "" }` | Empty |
| `{ "name": "   " }` | Whitespace only - rejected **after** trimming |
| `{ "name": "<256 code points>" }` | Over the 255 code-point limit |
| `{ "name": "Acme\u0007" }` | Contains a control character (Unicode `Cc`) |

Accepted, for contrast:

| Request body | Why it passes |
|---|---|
| `{ "name": "  Acme  " }` | Trimmed to `Acme` and stored |
| `{ "name": "Organização Ágape" }` | Non-ASCII letters are allowed |
| `{ "name": "Acme" }` twice | `name` is **not unique** - both succeed |
| 255 astral characters | 255 **code points**, 510 UTF-16 units |

## `GET /orgs/:orgId.json`

### Request

```
GET /api/orgs/1.json
Cookie: access_token=<jwt>
```

### Success - as the owner

```json
{
  "id": 1,
  "name": "Acme",
  "role": "owner",
  "created_at": "2026-11-01T09:12:44.000Z",
  "updated_at": "2026-11-01T09:12:44.000Z"
}
```

### Success - same organization, different caller

```json
{
  "id": 1,
  "name": "Acme",
  "role": "user",
  "created_at": "2026-11-01T09:12:44.000Z",
  "updated_at": "2026-11-01T09:12:44.000Z"
}
```

- **The same URL returns different bodies to different callers**, because `role` describes the
  caller's membership. This is why the response is `user-scoped` in the cache and never public.
- The second example is illustrative of the contract; today only `owner` occurs, since a second
  membership cannot be created (#82).

### Failure - unknown, malformed, foreign or non-member

All four cases answer **the same body**. Transcribed:

```json
{
  "error": { "code": "NOT_FOUND", "message": "Not Found" },
  "statusCode": 404,
  "timestamp": "2026-11-24T11:32:41.902Z"
}
```

| Request | Why it is a `404` |
|---|---|
| `GET /api/orgs/999.json` | No such organization |
| `GET /api/orgs/abc.json` | Not numeric - rejected by `parseOrgId()` |
| `GET /api/orgs/1e3.json` | Not a plain integer - **not** coerced to `1000` |
| `GET /api/orgs/0.json` | Not a positive integer |
| `GET /api/orgs/007.json` | Not the canonical form |
| `GET /api/orgs/7.json` where 7 exists but the caller is not a member | Non-member |
| The same, as a **global admin** who is not a member | No `is_admin` bypass |

The body is identical in every case: no case is distinguishable from the response.

## `PATCH /orgs/:orgId.json`

### Request

```
PATCH /api/orgs/1.json
Cookie: access_token=<jwt>
Content-Type: application/json

{ "name": "Acme Holdings" }
```

Same DTO as create: **`name` only**, required, trimmed, 255 code points, no `Cc`.

### Success

```json
{
  "id": 1,
  "name": "Acme Holdings",
  "role": "owner",
  "created_at": "2026-11-01T09:12:44.000Z",
  "updated_at": "2026-11-24T11:34:19.000Z"
}
```

- `name` changes; `updated_at` moves.
- `role` is **unchanged and still the caller's**.
- **Last write wins** on concurrent renames: no optimistic locking, no version column, no `If-Match`.

### The check order, in examples

This is the part most likely to be implemented or tested backwards. The three checks run in this
exact sequence.

#### 1. Invalid body + unknown organization → `400`, not `404`

```
PATCH /api/orgs/999999.json

{ "role": "admin" }
```

Answer: **`400 VALIDATION_FAILED`** (reconstructed body).

The body is validated **before** `:orgId` is resolved, so an invalid body answers `400` even for an
organization that does not exist. The `400` depends only on the body, so it cannot be used to
enumerate organizations.

#### 2. Valid body + non-member → `404`, not `403`

```
PATCH /api/orgs/99.json

{ "name": "Whatever" }
```

Answer: **`404`** - the same uniform body as before. A non-member never receives a `403`, so they
cannot learn that the organization exists.

#### 3. Valid body + member with role `user` → `403`

Answer - transcribed:

```json
{
  "error": { "code": "FORBIDDEN", "message": "Forbidden" },
  "statusCode": 403,
  "timestamp": "2026-11-24T11:35:50.331Z"
}
```

- Names **neither the resource nor the required role**.
- Only ever reached by a **member** - see case 2.
- The check lives in `OrganizationService.rename` via `hasMinRole(membership.role, ADMIN)`, not in
  `@MinOrgRole`, because these routes are not owner-scoped.

## Consolidated failure table

| Request | Status | Body family |
|---|---|---|
| Any route, no `access_token` cookie | `401` | `Missing access token` |
| Any route, bad/expired token, revoked session, `pending` or `denied` user | `401` | uniform `UNAUTHORIZED` |
| `POST` / `PATCH` with an unknown body field | `400` | `VALIDATION_FAILED` |
| `POST` / `PATCH` with a missing, empty, oversized or `Cc`-containing `name` | `400` | `VALIDATION_FAILED` |
| `GET` / `PATCH` with unknown, malformed, foreign `:orgId`, or as a non-member | `404` | uniform `NOT_FOUND` |
| `PATCH` as a member with role `user` | `403` | uniform `FORBIDDEN` |

Ordering on `PATCH`: **`400` → `404` → `403`**. Ordering everywhere else: **`401` → `404` →
`403`**.

## Response field reference

Every successful organization response, on all four routes:

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Primary key |
| `name` | string | Trimmed, validated; always rendered escaped as React text |
| `role` | `"owner"` \| `"admin"` \| `"user"` | **The caller's** role, not the owner's |
| `created_at` | timestamp (ISO 8601) | Set on insert |
| `updated_at` | timestamp (ISO 8601) | Updated on every write |

**Never present**, on any route: member list, member count, other users' ids, membership ids,
`owner` identity, `is_admin`, `created_by`, `slug`.

## Frontend paths, mapped to the routes

| UI action | Route |
|---|---|
| `GET /orgs.json` on session start | `OrgListController` loads it once |
| Create organization from the switcher | `POST /orgs.json`, from `#/orgs/new` |
| Open an organization | `GET /orgs/:orgId.json`, at `#/orgs/:orgId` |
| Rename from the overview | `PATCH /orgs/:orgId.json`, from `#/orgs/:orgId/edit` |

The API path is built with `contextPath(context, '/orgs.json')`, which yields `/orgs.json` in
Personal and `/orgs/1/orgs.json` in an organization - but the organization routes themselves are
always called in the **Personal** form, because they are the organization surface, not a module
mounted under one. See [Frontend](./frontend.md).

## What is not documented in the repository

The project documentation transcribes the `401`, `403` and `404` bodies, the field set, the statuses
and the check order. It does **not** contain:

- the **`400 VALIDATION_FAILED` body** - the code is named, the JSON shape is not. Every `400` in
  this page is reconstructed and labelled;
- whether `error.details` appears on a validation failure - the frontend `ApiError` documents a
  `details` field carrying validation messages, but the organization routes' `400` payload is not
  quoted;
- the **exact timestamp format** the API emits - ISO 8601 is assumed from the documented `timestamp`
  field; the precision (milliseconds, `Z` suffix) is not stated;
- whether `created_at` / `updated_at` are serialized as strings or numbers;
- any **request example** as printed by the docs - the requests here are constructed from the
  documented DTO rules;
- an OpenAPI/Swagger document, if one exists;
- the `X-Cache-Allow` header value on the two `GET`s, and the exact `X-Skip-Cache` placement;
- whether `PATCH` with an unchanged name still bumps `updated_at`.

Read `backend/src/auth/organization.controller.ts`,
`backend/src/auth/dto/organization-name.dto.ts` and the running API for the authoritative payloads.
Nothing on this page is invented beyond the documented rules, and every reconstructed payload is
marked as such.
