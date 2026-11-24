# Organizations - Security

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Roles](./roles.md), [Owner context](./owner-context.md), [Endpoints](./endpoints.md),
[Caching](./caching.md), [Tests](./tests.md).

## Summary

Six rules carry the security of the organization surface:

1. **Authentication first.** Every organization route requires the JWT gate; only `approved`
   users are authenticated.
2. **404 before 403.** The membership check always runs before the role check, so a `403` never
   reveals that an organization exists.
3. **Uniform 404.** An unknown, malformed or foreign `:orgId`, and a non-member - a global admin
   included - all answer the **same** body.
4. **Uniform 403.** Every role failure answers the same body, naming neither the resource nor the
   required role.
5. **No `is_admin` bypass**, anywhere in the organization path.
6. **No client-supplied owner or role.** Neither comes from the body, and the owner does not come
   from the URL beyond `:orgId`.

Everything else on this page follows from those six.

## Threat model

The surface is small: four routes, one entity, one name field. The realistic threats are
therefore not exotic - they are the four ways a small multi-tenant surface usually leaks.

| Threat | What the attacker wants | Mitigation |
|---|---|---|
| **Horizontal access** | Read or write another user's personal data | Personal routes carry **no user id**: personal always means the JWT user |
| **Cross-tenant access** | Read an organization's data without belonging to it | Membership checked on **every** request, re-read from the DB, no cache, no bypass |
| **Enumeration** | Learn which organization ids exist | **Uniform 404** for unknown, malformed, foreign and non-member alike |
| **Privilege escalation** | Obtain a higher role than the membership grants | Role **never from input**; always from the DB membership; hard-coded `owner` at creation |

Two secondary concerns also matter: leaking one caller's response to another through a shared
cache, and leaking organization names into logs.

## Authentication boundary

- Every organization route is **JWT-protected**: none carries `@Public()`.
- `JwtGuard`'s session-lookup gate applies. Every gate rejection answers the **same** `401` body,
  byte-for-byte apart from `timestamp`:

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired access token" },
  "statusCode": 401,
  "timestamp": "<ISO 8601>"
}
```

- A missing `access_token` cookie answers `401 Missing access token`.
- **Only `approved` users are authenticated.** A `pending` user holds a real session but its access
  tokens are blocked by the gate; a `denied` user cannot log in at all.
- A `denied` user's memberships and personal data are **kept but unreachable**. Organization data
  they created belongs to the organization and outlives their access.
- A database error during the lookup stays a `500` (`INTERNAL_ERROR`) - it is never converted into
  a `401` or a `404`.

## 404 before 403

The single most important ordering rule on this surface.

The pipeline is:

1. `JwtGuard` - authenticate, or the gate `401`.
2. `OwnerContextGuard` - resolve the owner:
   - missing user, malformed `:orgId`, unknown `:orgId`, not a member → **uniform `404`**;
   - store `request.ownerContext`;
   - **only then** read `@MinOrgRole` and compare.
3. Role too low → **uniform `403`**.

Consequences:

- A **`403` is only ever reached by a member.** A non-member cannot obtain one.
- A non-member therefore cannot distinguish "no such organization" from "organization exists but
  you are not in it". Both are the same `404`.
- The ordering is **structural**, not a matter of message choice: the membership resolution and the
  role comparison are separate steps in that sequence inside the guard.

## Uniform 404

One body for every resolution failure:

```json
{
  "error": { "code": "NOT_FOUND", "message": "Not Found" },
  "statusCode": 404,
  "timestamp": "<ISO 8601>"
}
```

It covers, indistinguishably:

| Case |
|---|
| `:orgId` is not numeric |
| `:orgId` is numeric but no such organization exists |
| `:orgId` exists but the caller is not a member |
| `:orgId` is foreign - e.g. an organization id used on a route of another module's context |
| The caller is a **global admin** who is not a member |

- **Records are looked up only inside the active owner context**, so the wrong context - an
  organization record addressed on a personal route, or the reverse - answers the same `404` as an
  unknown id.
- The response body is identical in all cases, so no case is inferable from timing-independent
  content. It does **not** claim to be timing-equalised - see
  [What is not documented](#what-is-not-documented-in-the-repository).

## Uniform 403

One body for every role failure:

```json
{
  "error": { "code": "FORBIDDEN", "message": "Forbidden" },
  "statusCode": 403,
  "timestamp": "<ISO 8601>"
}
```

- It names **neither the resource nor the required role**.
- It does **not** say whether the caller is close to the required role.
- Produced by `orgRoleForbidden()` (`core/org-role.ts`), so every call site emits the same body.
- Reached for: a route minimum role, a payment-generated transaction, and a rename attempt by a
  `user`. See [Roles](./roles.md).

## No `is_admin` bypass

Ward's global administrator is a **platform** role, and it grants **nothing** in the organization
path.

| | Organization role | Global admin |
|---|---|---|
| Stored on | `auth_organization_memberships.role` | `auth_users.is_admin` |
| Scope | One organization | Whole platform |
| Organization access | Yes, inside that organization | **No** |
| Non-member probe result | `404` | **`404` - the same one** |

- The role is re-read from the DB on **every** request, with **no** admin override and **no**
  caching.
- Being an organization `owner` grants **nothing** outside that organization.
- **Personal data is owner-only**: never visible to organization members - even of an organization
  the owner belongs to - nor to the global `is_admin`.
- Ward's global `is_admin` still covers **accounts only**.

## Three doors for the owner, two of them closed

The owner of a request could arrive from three places. Only one is legitimate.

| Door | Status | Closed by |
|---|---|---|
| The **JWT** (the authenticated user) | **Open** - the only legitimate source | - |
| The **URL** beyond `:orgId` | Closed | Personal routes carry **no user id**; there is no owner segment to tamper with |
| The **body** | Closed | `@StrictBody()` rejects **any** unknown field, owner fields included |

### No client-supplied owner or role

- **`organizationId`** comes **only from the URL**, after the membership check - never from the
  body.
- **`role` is never input.** `create` always sets `owner`; the role used for every check comes
  **only from the DB membership**, through `findRole`.
- **Organization bodies accept only `name`.** Any other field - `role`, `organizationId`, `userId`,
  anything - answers `400 VALIDATION_FAILED` before any service code runs.
- This is what makes "no client-supplied owner" true at the **transport layer**, not by convention.
- Handlers take bodies **only through `@StrictBody()`** (`core/strict-validation.pipe.ts`).

## Organization name validation

The only free-text field in the domain, so it is validated explicitly.

| Rule | Detail |
|---|---|
| Trimmed | Leading and trailing whitespace removed **before** validation and storage |
| Required | Empty or whitespace-only after trimming → rejected |
| Maximum length | **255 code points** - counted in code points, **not** UTF-16 units |
| Control characters | **Rejected** - Unicode category `Cc` |
| Other Unicode | **Allowed** - any other code point is accepted |
| Uniqueness | **Not unique.** Two organizations may share a name, including two organizations of the same user |
| Rendering | Always **escaped** - React text, never HTML |

Two notes on those rules:

- **Code points, not UTF-16 units** matters for characters outside the Basic Multilingual Plane:
  an emoji or some CJK extension characters occupy two UTF-16 units but one code point. Counting
  in UTF-16 units would reject legitimate names early and accept others late.
- **Rejecting control characters** (`Cc`) prevents stored values that break logs, terminals and
  headers. It does not attempt to restrict scripts or normalize Unicode.

### Names are never logged

- Organization names are **never written to logs**, on any path - create, rename, read.
- This extends the module's rule that a name is treated as user content, not as diagnostic data.

## Minimal responses - enumeration by response body

The organization serializer returns only:

```
{ id, name, role, created_at, updated_at }
```

- **`role` is the caller's role**, not the owner's role.
- **Member lists are never returned.** There is no endpoint that returns them at all.
- **Other users' ids are never returned.**
- `OrganizationMembership` is **never** serialized to the public API.
- Records of user-or-organization-owned modules never expose owner fields.

Consequence: even a successful read of an organization tells the caller nothing about who else
belongs to it. Today that is trivially true because every organization has exactly one member, but
the response shape is already the one that stays safe when joining exists.

## Cache as a security boundary

Caching is treated as part of the security contract, not as an optimization detail.

| Rule | Detail |
|---|---|
| Controller default | Cache class **`never`** - every route sends `X-Skip-Cache: true` |
| The two `GET`s | Narrowed to **`user-scoped`** - cached **per caller** |
| Writes | `never` - plus `Cache-Control: no-store` |
| An organization id in the URL | Does **not** make a response public |

Two reasons the last row matters:

- **Personal routes carry no owner in the URL.** A shared cache would key only on the path, so one
  user's response could be served to another. They **must** be `user-scoped`, with no exception.
- **Organization routes carry the id in the URL**, which looks cacheable by path - but the response
  contains the **caller's role**, so it is caller-dependent even with the same id.

The write-path rule has a documented rationale: Tent's `default_proxy` rule caches any `2xx`
`*.json` response keyed only by query string, **regardless of HTTP method**. An uncapped response
could therefore be cached after the first call and served to a different caller. The organization
routes send `X-Skip-Cache: true` on **every** route, writes included.

See [Caching](./caching.md).

## Concurrency

- **Concurrent renames: last write wins.** There is no optimistic locking, no version column and no
  `If-Match`.
- This is a **documented acceptance**, not an oversight: two simultaneous renames leave one of the
  two names, chosen by write order.
- No other concurrent write exists: creation always inserts a new row, and there is no delete.

## Known gaps - documented, not built

| Gap | Status |
|---|---|
| `POST /orgs.json` rate limiting | **Not built.** Rate-limiting creation is [#84](https://github.com/darthjee/ward/issues/84). A user may create unlimited organizations today |
| Closing (deleting) an organization | **Not built** ([#83](https://github.com/darthjee/ward/issues/83)). `ON DELETE RESTRICT` blocks it while memberships exist |
| Removing a member / leaving | **Not built** ([#82](https://github.com/darthjee/ward/issues/82)) |
| Audit trail / authorship | **Not built** ([#95](https://github.com/darthjee/ward/issues/95)). There is no `created_by` column |
| Moving a record between owners | **Not built** ([#93](https://github.com/darthjee/ward/issues/93)) |
| Sharing a personal record with an organization | **Not built** ([#94](https://github.com/darthjee/ward/issues/94)) |
| `POST /auth/recover.json` timing equalisation | Not equalised, per `architecture/security.md` |

The creation rate limit is the one with direct security weight today: nothing throttles a user
creating organizations other than the platform's own request capacity.

## `data-access` review checklist

The rules a reviewer enforces, verbatim in substance, for user-or-organization-owned modules:

1. Every query is filtered through the **`OwnerContext`** resolved by `OwnerContextGuard`
   (`ownerWhere()` / `ownerSqlWhere()`).
2. Personal queries use **only the JWT user** as owner.
3. Every `/orgs/:orgId/...` route verifies the current user's membership of `:orgId` - it is
   mounted with `@OwnerScopedController()` or carries `@OwnerScoped()`.
4. **No owner fields** are read from input (the URL beyond `:orgId`, or the body) or written to
   output.
5. Unknown id, wrong context and non-member all get a **uniform `404`** with identical bodies, with
   no disclosure that a record or organization exists.
6. Every owner-scoped write route declares a minimum role with **`@MinOrgRole`**; organization
   routes outside that mechanism check the role in the service (as `OrganizationService.rename`
   does); record-dependent rules check it in the service and **fail closed**.
7. The role **never comes from input**: only from the DB membership through `findRole`, re-read on
   every request.
8. The non-member **`404` comes before any `403`**.
9. The **`403` body is uniform** - `FORBIDDEN` / `Forbidden`, no resource or role named.
10. There is **no `is_admin` bypass**.

User-owned modules keep the usual per-user checks instead.

See [Tests](./tests.md) for the automated side of this checklist.

## Failure answers, consolidated

| Situation | Where caught | Answer |
|---|---|---|
| No `access_token` | `JwtGuard` | `401 Missing access token` |
| Bad signature, expired token, malformed claims, revoked/expired session, session of another user | `JwtGuard` gate | uniform `401` |
| `pending` or `denied` user | `JwtGuard` gate | uniform `401` |
| Missing user, malformed `:orgId`, unknown `:orgId`, non-member, non-member global admin | `OwnerContextGuard` / membership lookup | uniform `404` |
| Record addressed in the **wrong context** | owner-scoped lookup | uniform `404` |
| Member with too low a role | `@MinOrgRole` or the service | uniform `403` |
| Unknown body field, `role` and owner fields included | `@StrictBody()` / DTO | `400 VALIDATION_FAILED` |
| `name` missing, empty after trim, over 255 code points, or with a `Cc` character | `OrganizationNameDto` | `400 VALIDATION_FAILED` |
| Database error during the session lookup | - | `500 INTERNAL_ERROR` |

## Design properties worth preserving

These are the invariants a future change is most likely to break silently.

- **The guard is global but inert.** It runs on every route and acts only where `@OwnerScoped()`
  exists. Replacing it with per-route guards reintroduces the "one forgotten `if`" failure.
- **`:orgId` is parsed as a raw string.** Any numeric coercion lets `1e3` become `1000` and resolve
  a different organization than the one in the path.
- **The role is never cached.** A cached role would keep a revoked member working until expiry.
- **The body is closed by a pipe, not by a whitelist convention.** `@StrictBody()` rejects unknown
  fields; a plain `@Body()` would silently accept them.
- **The serializer is minimal by design.** Adding a member list to the organization response would
  turn four routes into an enumeration surface.
- **Names are not logged.** Logging them would move user content into the observability path.

## What is not documented in the repository

The `docs/agents/` pages state every rule, ordering and response body on this page. They do **not**
contain:

- the source of `@StrictBody()` (`core/strict-validation.pipe.ts`) or `organization-name.dto.ts`:
  the validation decorators, the error payload shape, and whether the trim happens in the DTO or
  before it;
- the exact `400 VALIDATION_FAILED` body - the docs name the code, not the JSON shape;
- whether the `401` / `404` / `403` bodies are built by a shared filter, a shared exception class,
  or per-site;
- the implementation of `orgRoleForbidden()`;
- whether the `404` path is `NotFoundException` or a custom class;
- any timing-equalisation between "unknown organization" and "not a member" - the bodies are
  identical, and the docs assert nothing about response time;
- the `X-Cache-Allow` value sent on the two `GET`s;
- whether any of this is covered by an authorization-specific test suite beyond the coverage spec
  referenced in [Tests](./tests.md).

Read `backend/src/core/` and `backend/src/auth/dto/` for the authoritative version. Nothing on this
page is inferred beyond what the docs state.
