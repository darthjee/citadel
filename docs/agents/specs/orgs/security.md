# Organizations - Security

Hub: [Organizations](../orgs.md).

## Threat model

What the organization surface must resist, and the mechanism for each.

| Threat | Mechanism |
|---|---|
| Reading another organization's data | Membership resolution before any data access; non-member gets the uniform `404` |
| **Enumerating** organizations or records | One uniform `404` for every failure case - existence is never confirmed |
| Learning that an organization exists via a `403` | The `404` check runs **before** the `403` check |
| Supplying an owner or a role | `@StrictBody()` rejects unknown fields; the role is never read from input |
| Escalating via the global admin flag | **No `is_admin` bypass** anywhere in the organization path |
| Reaching another user's personal data | Personal routes carry no user id - Personal always means the JWT user |
| Gaining access by guessing an id | `parseOrgId()` rejects malformed ids; membership is checked regardless |
| Acting after losing membership mid-session | The role and the membership are re-read from the database on every request |
| Confusing another user's cache entry | `user-scoped` cache class, never `public` |

Two threats are **not** covered, by design or by backlog:

| Not covered | Reason |
|---|---|
| Rate-limiting organization creation | Not built (#84). A user may create organizations as fast as the platform accepts requests |
| Preventing an orphaned `organization_id` in a module | `bank` references `auth_organizations` **logically**, without a foreign key. The database will not object |

## The 404 / 403 contract

The core of the domain's security. Two responses, each with one fixed body.

### The uniform 404

Everything that fails to resolve answers the same body:

| Case | Why it is a `404` |
|---|---|
| Organization does not exist | Nothing to show |
| `:orgId` is not numeric | Cannot resolve |
| `:orgId` is out of the accepted range | Cannot resolve |
| Organization exists, caller is not a member | No access |
| Organization exists, caller is a **global admin** but not a member | No `is_admin` bypass |

The body never names the resource. The four cases are **indistinguishable**.

### The uniform 403

Only reachable by a **member** whose role is too low.

- Body is `FORBIDDEN` / `Forbidden`.
- Names **neither** the resource **nor** the required role.
- A non-member can never trigger it, because the `404` check comes first.

### The ordering rule

```
1. Does :orgId resolve and is the caller a member?   no -> 404
2. Does the role meet the minimum?                   no -> 403
3. Proceed
```

Reversing the two turns the endpoint into an **existence oracle**: an attacker could distinguish "no
such organization" from "exists but I am not allowed" by the status code alone.

`PATCH` prepends the body check: **`400` > `404` > `403`**. The `400` depends only on the body, so it
reveals nothing.

## No client-supplied owner or role

Three separate mechanisms, all pointing the same way.

| Mechanism | What it blocks |
|---|---|
| **`@StrictBody()`** | Any body field not in the DTO - `role`, `organizationId`, `userId` all answer `400` |
| **`OrganizationNameDto`** | The DTO itself declares only `name` |
| **Service logic** | `create` hard-codes `role: 'owner'`; `organizationId` comes only from the URL after the membership check |

The DTO is a second line of defence, not the only one. Even if a `role` field were added to the DTO
by mistake, `create` would ignore it.

The role is **never** read from a body, a query parameter or a header. It comes from
`OrganizationMembership.role` through `findRole`, re-read on every request, with no cache.

## The global admin grants nothing here

| Concept | Scope | Effect on organizations |
|---|---|---|
| `owner` / `admin` / `user` | One organization | Access to that organization |
| Global admin (`is_admin`) | The platform | **None** |

- A global admin who is not a member answers `404`, exactly like anyone else.
- There is **no `is_admin` bypass** anywhere in the organization path.
- `AdminGuard` / `@AdminOnly()` protect the admin routes and are unrelated to this surface.

This is the most commonly assumed-in error: "an admin can see everything" is false for organizations.

## Personal data is owner-only

| Rule | Detail |
|---|---|
| Visible to | The owning user **only** |
| Visible to organization members | **Never** - not even members of an organization the owner belongs to |
| Visible to the global admin | **Never** |
| Addressable by id | No. Personal routes carry no user id, so another user's data cannot be named |

The structural guarantee: an organization record has **`user_id` `NULL`**, so a personal query
filtered by `user_id` is **structurally unable** to return it. The separation is enforced by the data
shape, not by a conditional.

## The user reference means owner, never creator

| Field | Means | Does not mean |
|---|---|---|
| `user_id` on a record | The **owner** of the record | Who created it |
| An organization record's `user_id` | Always `NULL` | The creating member |

Consequences:

- An organization record is **not** owned by the member who created it - it is owned by the
  organization.
- Suspending or denying a user does **not** orphan organization data, because that user never owned
  it.
- There is **no `created_by`** column anywhere (#95). An authorship trail does not exist.

## Name validation

The only free-text field in the domain, and therefore the only input surface worth hardening.

| Rule | Detail |
|---|---|
| Trimmed | Before validation and storage |
| Non-empty | Whitespace-only is rejected **after** trimming |
| Maximum | **255 code points**, not UTF-16 units |
| Control characters | Rejected - Unicode category `Cc` |
| Other Unicode | Allowed - accents, emoji, CJK |
| Uniqueness | **None** - duplicate names are legal, including for the same user |

### Why code points

A character outside the Basic Multilingual Plane - an emoji, some CJK extensions - is **two** UTF-16
units but **one** code point.

- A validation written against `name.length` measures UTF-16 units and would **reject a valid name**.
- A test using only ASCII cannot tell the two implementations apart.

## Rendering

Organization names are **always rendered as React text**, never as HTML.

- No `dangerouslySetInnerHTML` on any field.
- A name containing `<script>` is displayed literally, not executed.
- The backend stores the name as given (trimmed); the escaping is the renderer's responsibility, on
  both the React side and any future client.

## The `data-access` review checklist

For user-or-organization-owned modules, a reviewer checks ten things.

| # | Rule |
|---|---|
| 1 | Every query is filtered through the **`OwnerContext`** resolved by `OwnerContextGuard` (`ownerWhere()` / `ownerSqlWhere()`) |
| 2 | Personal queries use **only the JWT user** as owner |
| 3 | Every `/orgs/:orgId/...` route verifies the current user's membership of `:orgId` - mounted with `@OwnerScopedController()` or carrying `@OwnerScoped()` |
| 4 | **No owner fields** are read from input (the URL beyond `:orgId`, or the body) or written to output |
| 5 | Unknown id, wrong context and non-member all get a **uniform `404`** with identical bodies |
| 6 | Every owner-scoped write route declares a minimum role with **`@MinOrgRole`**; organization routes outside that mechanism check the role in the service; record-dependent rules check it in the service and **fail closed** |
| 7 | The role **never comes from input**: only from the DB membership through `findRole`, re-read on every request |
| 8 | The non-member **`404` comes before any `403`** |
| 9 | The **`403` body is uniform** - `FORBIDDEN` / `Forbidden`, no resource or role named |
| 10 | There is **no `is_admin` bypass** |

User-owned modules keep the usual per-user checks instead of this list.

### Where each violation would live

| Rule | File that would carry the bug |
|---|---|
| 1, 2 | Any repository query in a domain module; raw SQL in the ledger |
| 3 | The controller decorator - `@OwnerScopedController()` versus a hand-mounted prefix |
| 4 | The DTO (`@StrictBody()` and the field list) and the serializer |
| 5 | The lookup that throws `404` - and whether it is the **same** throw for every case |
| 6 | `@MinOrgRole` on the method or class, and `OrganizationService` for the service checks |
| 7 | Any code reading a role from a body, a query param or a header |
| 8 | The guard's internal ordering - membership before role |
| 9 | `orgRoleForbidden()` versus a hand-built error |
| 10 | Anything consulting `User.isAdmin` inside an owner-scoped path |

## What structural tests cannot catch

The ten rules above are **semantic**. A test that only inspects decorators passes while every one of
these is broken:

| Missed failure | Why it slips through |
|---|---|
| A query missing `ownerWhere()` | The query is well-formed; only the **absence** of a filter is wrong |
| A role read from the body | `@StrictBody()` is present; the DTO merely includes a field it should not |
| A `403` thrown before the `404` | Both are thrown; only their **order** is wrong |
| A `404` body that differs by case | Each throw is uniform; the **set** of throws is not |
| A service receiving a raw `organizationId` | Perfectly valid TypeScript |
| A cached role | A performance choice, not a decorator violation |

That gap is why the review checklist exists alongside the automated coverage spec. See
[Tests](./tests.md).

## Boundaries worth stating

| Boundary | Behaviour |
|---|---|
| Unknown vs. foreign organization | Identical `404`. No distinction is observable |
| Non-member vs. non-existent | Identical `404` |
| Member with low role vs. non-member | Different - `403` vs `404` - but the `403` is only for members |
| Denied user with an `owner` membership | Cannot log in. The membership and the organization's data remain, unreachable |
| Deleted user | Blocked by `ON DELETE RESTRICT` while any membership references them |
| Organization with a suspected orphan `bank` row | Nothing in the database prevents it |

## What is not documented in the repository

The project documentation states the threat model, the 404/403 contract, the ordering rule, the
no-bypass rule, the `name` rules and the ten review criteria. It does **not** contain:

- a **dedicated security page** in the organizations set - the content above is assembled from the
  module page, the endpoints page and the review checklist;
- any rate limiting on `POST /orgs.json` - it is documented as **not built** (#84);
- any CSRF discussion specific to the organization routes, beyond the `sameSite: 'strict'` cookie;
- whether the `400` response carries validation details that could leak schema information;
- any logging, alerting or audit trail for repeated `404`s or `403`s - there is no audit table;
- whether a name containing HTML is escaped on the backend or only on render;
- any penetration-test results or threat-model document beyond the rules listed here.

Read `docs/agents/modules/auth/organizations.md` and
`docs/agents/agents/data-access.md` - the latter is the reviewer definition the checklist comes from -
for the authoritative version. Nothing on this page is inferred beyond what the docs state.
