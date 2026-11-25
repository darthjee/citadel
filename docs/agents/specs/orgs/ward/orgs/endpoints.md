# Organizations - Endpoints

Hub: [Organizations](../orgs.md).

## Summary

Four routes. No `/api` prefix in the backend - the proxy adds it.

| Method | Path | Success | Minimum role |
|---|---|---|---|
| `GET` | `/orgs.json` | `200` array | any member - here, the caller's own list |
| `POST` | `/orgs.json` | `201` object | any approved user |
| `GET` | `/orgs/:orgId.json` | `200` object | membership |
| `PATCH` | `/orgs/:orgId.json` | `200` object | `admin` |

Every route returns the same five-field shape: `id`, `name`, `role`, `created_at`, `updated_at`.

Concrete requests and responses: [Examples](./examples.md).

## The `/api` prefix

| Layer | Path |
|---|---|
| Backend controller | `/orgs.json`, `/orgs/:orgId.json` |
| Browser | `/api/orgs.json`, `/api/orgs/1.json` |

The proxy adds `/api`. The controller carries **no path prefix** - it is not mounted under `/orgs`
and not under `/api`. See [Caching](./caching.md) for the other proxy responsibility.

## Authentication

All four routes require the **`access_token` cookie**.

| Property | Value |
|---|---|
| Name | `access_token` |
| Flags | `httpOnly`, `secure`, `sameSite: 'strict'` |
| TTL | `WARD_ACCESS_TOKEN_TTL_MS`, default 15 minutes |
| In a response body | **Never** |

`JwtGuard` reads the cookie, verifies the signature and expiry, validates the `sid` / `sub` claims,
and loads `request.user` from the session through `SESSION_LOOKUP`.

| Situation | Answer |
|---|---|
| Missing cookie | `401 Missing access token` |
| Bad signature, expired, malformed claims, unknown `sid`, revoked session, `pending` or `denied` user | `401 Invalid or expired access token` - the same body for all |

There is **no Bearer header** and no query-parameter token. Cookie only.

## `GET /orgs.json`

The organizations the caller belongs to.

| Property | Detail |
|---|---|
| Order | By organization `id` |
| Pagination | **None** |
| Envelope | **None** - the array is returned bare |
| Empty | `200` with `[]` |
| `role` field | The **caller's** role in each organization |

Each item: `{ id, name, role, created_at, updated_at }`.

With no way to join, every item has `role: "owner"` today. Zero organizations is the **normal state**
for a new user, and it answers `200 []` - not `404`, not `null`.

No query parameters are accepted.

## `POST /orgs.json`

Creates an organization. The caller becomes its `owner`.

### Body

| Field | Required | Rules |
|---|---|---|
| `name` | **yes** | Trimmed; non-empty after trim; at most **255 code points**; no control characters (Unicode `Cc`) |

**`name` is the only accepted field.** Any other field answers `400` - including `role`,
`organizationId` and `userId`, rejected by `@StrictBody()`.

### Response

`201` with the organization, `role: "owner"`.

### Behaviour

| Property | Detail |
|---|---|
| Who may create | Any **approved** user. Not limited to admins or owners |
| Transaction | The organization **and** the `owner` membership, in one transaction |
| Role | Hard-coded to `owner`. Never read from input |
| Cap per user | **None** |
| Dedupe | **None** - the same name twice creates two organizations |
| Rate limit | **None built** (#84) |

A `pending` or `denied` user answers `401` at the gate, never `403`.

## `GET /orgs/:orgId.json`

Reads one organization the caller belongs to.

| Situation | Answer |
|---|---|
| Member | `200` with the five fields, `role` being the caller's |
| Not a member | uniform `404` |
| Organization does not exist | uniform `404` |
| Malformed `:orgId` | uniform `404` |
| Global admin, not a member | uniform `404` |

The four `404` cases are **indistinguishable from the response** - same body, same status.

The same URL therefore returns **different bodies to different callers**, because `role` describes
the caller's membership. That is why the response is `user-scoped` in the cache and can never be
`public`.

## `PATCH /orgs/:orgId.json`

Renames an organization.

### Body

Same DTO as create: **`name` only**, required, trimmed, 255 code points, no `Cc`.

### Response

`200` with the organization. `name` and `updated_at` change; `role` is unchanged and still the
caller's.

### Role

Minimum `admin`. The check lives in `OrganizationService.rename` - these routes are **not**
owner-scoped, so `@MinOrgRole()` does not apply. See [Service](./service.md).

### Concurrency

**Last write wins.** No optimistic locking, no version column, no `If-Match`. Two concurrent calls
leave one of the two names, chosen by write order.

## The check order - `400` > `404` > `403`

On `PATCH`, three checks run in this exact sequence.

| Step | Check | Failure | Reveals |
|---|---|---|---|
| 1 | Body valid? | `400 VALIDATION_FAILED` | Nothing - depends only on the body |
| 2 | Membership exists? | uniform `404` | Nothing about existence |
| 3 | Role meets `admin`? | uniform `403` | Only reachable by a member |

Two consequences:

- **An invalid body answers `400` even for an unknown organization.** The body is validated before
  `:orgId` is resolved, so the `400` cannot be used to enumerate.
- **A non-member never receives a `403`.** A `403` never reveals that the organization exists.

On every other route the order is **`401` > `404` > `403`**.

## Filters and parameters

| Route | Query params | Filters |
|---|---|---|
| `GET /orgs.json` | **None accepted** | Implicitly the caller's memberships |
| `POST /orgs.json` | None | - |
| `GET /orgs/:orgId.json` | None | `:orgId` from the URL |
| `PATCH /orgs/:orgId.json` | None | `:orgId` from the URL |

There is **no pagination**, **no search**, **no sort parameter** and **no field selection**. The list
is the caller's memberships, ordered by `id`, and that is the whole contract.

## `:orgId` parsing

Parsed by `parseOrgId()` from a **raw string**.

| Input | Result |
|---|---|
| `7` | accepted |
| `0` | rejected |
| `007` | rejected |
| `abc` | rejected |
| `1e3` | rejected - **not** coerced to `1000` |
| `1.5` | rejected |
| above `2147483647` | rejected |

Every rejection answers the uniform `404`. The raw-string signature is the point: a parser taking a
number would have already turned `1e3` into `1000` and addressed a different organization.

See [Owner context](./owner-context.md).

## Cache headers

| Route | Cache class | `X-Skip-Cache` |
|---|---|---|
| `GET /orgs.json` | `user-scoped` | no - varies by caller |
| `GET /orgs/:orgId.json` | `user-scoped` | no - the same URL differs per caller |
| `POST /orgs.json` | `never` | yes |
| `PATCH /orgs/:orgId.json` | `never` | yes |

The two `GET`s are **never** `public`, because their bodies depend on who is asking. See
[Caching](./caching.md).

## Errors

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_FAILED` | Missing, empty, oversized or `Cc`-containing `name`; unknown body field |
| `401` | `UNAUTHORIZED` | Missing cookie (different message), or any gate rejection |
| `403` | `FORBIDDEN` | Member whose role is below `admin` - names neither resource nor role |
| `404` | `NOT_FOUND` | Malformed, unknown, foreign `:orgId`, or non-member |

Standard error body:

```
{ "error": { "code": "...", "message": "..." }, "statusCode": 400, "timestamp": "..." }
```

Concrete payloads: [Examples](./examples.md).

## What the routes never contain

| Never | Why |
|---|---|
| An owner identity | The caller's `role` is shown; who the `owner` is, is not |
| A member list | No endpoint exists, and the serializer has no field for it |
| A member count | Not stored |
| `ownerId`, `created_by` | Neither exists on the model |
| Another user's id | The response carries no user reference at all |
| A slug | Routes address by `id` only |

See [Response](./response.md).

## What is not documented in the repository

The project documentation states the four routes, the payloads, the statuses, the check order, the
filters and the cookie contract. It does **not** contain:

- the **exact route decorators** on `organization.controller.ts`, nor whether the controller is
  mounted with `@Controller()` and no argument;
- the `400` body shape - the code is named, the JSON is not quoted;
- whether `error.details` appears on a validation failure;
- the exact `Cache-Control` header value emitted for `user-scoped`;
- whether `GET /orgs.json` has any implicit limit at the database level;
- the precise wording of the two `401` messages beyond the two strings documented;
- whether `PATCH` with an unchanged name still bumps `updated_at`.

Read `backend/src/auth/organization.controller.ts` and the running API for the authoritative
version. Nothing on this page is inferred beyond what the docs state.
