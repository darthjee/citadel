# Organizations - Tests

Hub: [Organizations](README.md).

## Summary

The organization surface is guarded by two different things, and they should not be confused:

| Guard | Kind | Fails when |
|---|---|---|
| **Coverage spec** | Automated, backend | A route opts out of the owner-scoped contract: a plain `@Body()`, or an owner-scoped route declared `public` |
| **`data-access` review checklist** | Reviewer, documented | Any of ten rules is violated - uniform `404`, no owner from input, role from the DB, and so on |

The coverage spec catches **structural** opt-outs. The checklist catches **semantic** mistakes the
compiler cannot see. Neither replaces the other.

## Test stack

### Backend

| Tool | Role |
|---|---|
| **Jest** | Runner |
| **`@swc/jest`** | TypeScript/ESM transform |
| **`supertest`** | HTTP-level assertions against a Nest application |
| **`@nestjs/testing`** | Module/DI test harness |

- Source lives under `backend/src/`, with tests inside each module's own `tests/` folder.
- Migrations live under `backend/src/database/migrations/`.
- Tests run through Docker Compose, never on the host:
  `docker-compose run --rm ward_tests yarn test`.

### Frontend

| Tool | Role |
|---|---|
| **Jasmine** | Spec framework |
| **c8** | Coverage |
| Custom Node ESM loader | `specs/support/jsx-loader.mjs` - transforms `.jsx` via Babel, stubs image/CSS imports, shims `import.meta.env` |

- Specs live under `frontend/specs/`, mirroring `frontend/assets/js/`.
- Organization page specs exist under
  `frontend/specs/assets/js/components/resources/organizations/pages/controllers/`
  (`OrganizationNewControllerSpec.js`, `OrganizationEditControllerSpec.js`,
  `OrganizationLoaderSpec.js`) and under `pages/helpers/`.

### Lint as a test gate

ESLint is part of the same gate, and two of its limits shape how the organization code is written:

- **Max 300 lines per file.**
- **Max complexity 10.**

Both apply to backend and frontend. A guard or resolver that grows past either limit must be split,
which is part of why the owner-context mechanism is spread across small files in `core/` rather
than concentrated in one class.

## The coverage spec

**File**: `backend/src/core/tests/min-org-role.coverage.spec.ts`.

The documented purpose: fail the build on the two ways a route can **opt out** of the owner-scoped
contract.

| Failure | Why it matters |
|---|---|
| A handler taking a plain **`@Body()`** instead of `@StrictBody()` | A plain `@Body()` silently accepts unknown fields - including `role` and `organizationId`. It reopens the body as an owner source |
| An **owner-scoped route declared `public`** | A `public` route bypasses `JwtGuard`, so the owner resolution never runs and the response is cacheable by anyone |

Both are **structural** failures: they are visible in the decorators, without needing to reason about
behaviour. That is what makes a static coverage spec the right tool - it does not need fixtures, a
database or a scenario.

### What this implies for a new route

- The spec runs over the route surface, not over sample requests, so **a new route is covered the
  moment it is declared**. There is no registration step to forget.
- The two rules are absolute: no exception is documented for either. A route that genuinely needs a
  plain `@Body()` would have to change the spec, which makes the decision explicit and reviewable.

### On caching and the coverage spec

The cache class is **not** one of the two documented coverage-spec triggers. The rules that a route
may narrow to `never` but **never** to `public` come from `@OwnerScopedController()` bundling
scoping with the cache class - see [Caching](./caching.md) - not from an assertion listed for this
spec.

Whether a `public` cache class on an owner-scoped route is separately asserted is **not documented**.

## The `data-access` review checklist

For **user-or-organization-owned modules**, the `data-access` reviewer checks ten things. It is a
review surface, not necessarily an automated suite.

| # | Rule |
|---|---|
| 1 | Every query is filtered through the **`OwnerContext`** resolved by `OwnerContextGuard` (`ownerWhere()` / `ownerSqlWhere()`) |
| 2 | Personal queries use **only the JWT user** as owner |
| 3 | Every `/orgs/:orgId/...` route verifies the current user's membership of `:orgId` - mounted with `@OwnerScopedController()` or carrying `@OwnerScoped()` |
| 4 | **No owner fields** are read from input (the URL beyond `:orgId`, or the body) or written to output |
| 5 | Unknown id, wrong context and non-member all get a **uniform `404`** with identical bodies, no disclosure that a record or organization exists |
| 6 | Every owner-scoped write route declares a minimum role with **`@MinOrgRole`**; organization routes outside that mechanism check the role in the service (as `OrganizationService.rename` does); record-dependent rules check it in the service and **fail closed** |
| 7 | The role **never comes from input**: only from the DB membership through `findRole`, re-read on every request |
| 8 | The non-member **`404` comes before any `403`** |
| 9 | The **`403` body is uniform** - `FORBIDDEN` / `Forbidden`, no resource or role named |
| 10 | There is **no `is_admin` bypass** |

**User-owned modules** keep the usual per-user checks instead of this list.

### Mapping rules to files

| Rule | Where the violation would live |
|---|---|
| 1, 2 | Any repository query in a domain module; raw SQL in the ledger |
| 3 | The controller decorator - `@OwnerScopedController()` versus a hand-mounted prefix |
| 4 | The DTO (`@StrictBody()` and the DTO's field list) and the serializer |
| 5 | The lookup that throws `404` - and whether it is the **same** throw for every case |
| 6 | `@MinOrgRole` on the method or class, and `OrganizationService` for the service-level checks |
| 7 | Any code reading a role from a request body, a query param or a header |
| 8 | The guard's internal ordering - membership resolution before role comparison |
| 9 | `orgRoleForbidden()` versus a hand-built error |
| 10 | Anything consulting `User.isAdmin` inside an owner-scoped path |

## What the coverage spec cannot catch

Stated because it is the reason the checklist exists. Each of these passes the structural spec and
fails the contract:

| Missed failure | Why the spec cannot see it |
|---|---|
| A query missing `ownerWhere()` | The query is well-formed; only the **absence** of a filter is wrong |
| A role read from the body | `@StrictBody()` is present; the DTO merely includes a field it should not |
| A `403` thrown before the `404` | Both are thrown; only their **order** is wrong |
| A 404 body that differs by case | Each throw is uniform; the **set** of throws is not |
| A service receiving a raw `organizationId` | Perfectly valid TypeScript |
| A cached role | A performance choice, not a contract violation the AST shows |

Every one of these is a **semantic** failure. That is the gap the `data-access` review fills, and
why a route can pass CI and still be wrong.

## Failure-mode table - what to assert

Derived from the rules in [Security](./security.md). Useful as a test-writing checklist.

| Assertion | Expected |
|---|---|
| Non-member requests `GET /orgs/:orgId.json` | `404` with the same body as an unknown id |
| Global admin (non-member) requests the same | **identical** `404` |
| `user` requests `PATCH /orgs/:orgId.json` | `403`, body free of the resource and the role name |
| Body carries `role` | `400 VALIDATION_FAILED` |
| Body carries `organizationId` | `400 VALIDATION_FAILED` |
| `name` longer than 255 **code points** | `400 VALIDATION_FAILED` |
| `name` with a control character (`Cc`) | `400 VALIDATION_FAILED` |
| `name` empty after trimming | `400 VALIDATION_FAILED` |
| Invalid body **plus** unknown `:orgId` | `400` - the body check runs first |
| Valid body, unknown `:orgId` | `404`, not `403` |
| `POST /orgs.json` by an approved user | `201`, body carries `role: "owner"` |
| `POST /orgs.json` twice | **Two** organizations - no cap, no dedupe |
| `GET /orgs.json` for a user with none | `200` with `[]` |
| `GET /orgs.json` ordering | By `id` |
| Response body of any organization route | Only `id`, `name`, `role`, `created_at`, `updated_at` |
| Any organization route without `access_token` | `401` |
| Any organization route as a `pending` user | `401` |

Two of these deserve emphasis:

- **"Invalid body plus unknown `:orgId` → `400`"** pins the check order documented in
  [Endpoints](./endpoints.md). It is the assertion most likely to be written backwards.
- **"Response body contains only the five fields"** is the assertion that protects the enumeration
  property. A field-level allowlist check catches an accidental `members` addition immediately.

## Code-point counting

The 255 limit is on **code points, not UTF-16 units**. A test using `'a'.repeat(255)` passes under
both rules and proves nothing about the distinction.

The distinguishing cases:

- A character outside the Basic Multilingual Plane - an emoji, or some CJK extension characters -
  occupies **two** UTF-16 units but **one** code point.
- So a name of 255 astral characters is **255 code points** (valid) and **510 UTF-16 units**
  (would fail a naive length check).
- A validation implemented as `name.length` in JavaScript measures UTF-16 units, and would reject a
  valid name.

A test that only uses ASCII cannot tell the two implementations apart.

## Frontend specs

The frontend mirrors `assets/js/` under `specs/`.

| Area | What a spec pins |
|---|---|
| `HashRouteResolver` | Personal-only matches first; `/orgs/<seg>` stripping; `^[1-9][0-9]*$` and the `2147483647` bound resolving to `not-found` **without** a request; fallback to `home` |
| `contextPath` / `contextHash` / `landingFor` | Correct path per context |
| `ContextStorage` | Key `ward.context.<userId>`; org id only; `try`/`catch` fallback to Personal; **not** cleared on logout |
| `entryResolution` | Applied only at `''` or `#/`; only if the id is in the loaded list; stale id forgotten |
| `sectionTargetFor` | Segment-boundary matching; query string dropped |
| `can(role, action)` | **Fails closed**: `null` role and unknown action both answer `false` |
| `forbiddenRefreshEffect` | One refresh per burst of `403`s |
| `buildOwnerContextValue` | `role: 'owner'` in Personal; `null` while loading or unlisted |
| `OrganizationNewController` | The create submit path |
| `OrganizationEditController` | The rename submit path and the `403` message |
| `OrganizationLoader` | The overview load path |
| `OrganizationFormHelper` / `OrganizationOverviewHelper` | The rendered markup and the Rename link |

The `can()` row is the one with a clear mirror on the backend: the frontend matrix is a copy of the
backend's, and a divergence between them is invisible until a control is shown that the API refuses.

## Rules the tests encode that are easy to break

| Invariant | Breaking it looks like |
|---|---|
| `@StrictBody()` on every handler | Adding a route with a plain `@Body()` - **caught** by the coverage spec |
| No owner-scoped route is `public` | Declaring a route `public` to make an integration work - **caught** |
| The `404` precedes the `403` | Reordering checks in the guard for clarity - **not caught**; only a semantic test sees it |
| The role comes from the DB | Adding a `role` field to the body DTO - **not caught**; the DTO is valid |
| Every query is owner-filtered | Adding a repository call without `ownerWhere()` - **not caught** |
| The response is the five-field shape | Adding `members` to the serializer - **not caught**, unless a field-level assertion exists |

The split down that column is the practical takeaway: **two of six are structural**. The rest depend
on someone writing the assertion or the reviewer catching it.

## What is not documented in the repository

The project documentation states that a coverage spec exists at
`backend/src/core/tests/min-org-role.coverage.spec.ts`, names its two triggers, and lists the ten
`data-access` rules. It does **not** contain:

- the **source** of the coverage spec - whether it reflects over controllers, scans decorator
  metadata, or walks a manual route list;
- whether the cache class is asserted separately from the `public` route trigger;
- the full list of organization spec files, on either side - the ones listed on this page are the
  spec paths observed in the repository;
- any test asserting the **check order** (`400` before `404` before `403`), the **uniformity** of the
  `404` and `403` bodies across cases, or the **absence of `is_admin` bypass**;
- any test asserting the exact five-field response shape;
- coverage thresholds, if any are enforced;
- the frontend specs' contents for the routing resolver, `ContextStorage` or `can()` - the paths
  exist, what each spec asserts is not documented;
- whether the `data-access` checklist is enforced by tooling or by human review only.

Read `backend/src/core/tests/`, `backend/src/auth/tests/` and `frontend/specs/` for the authoritative
version. Nothing on this page is inferred beyond what the docs state.
