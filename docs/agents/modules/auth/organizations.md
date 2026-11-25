# Auth — Organizations

Optional organization ownership: a group of users that can own domain data instead of a single
user. Part of the [Auth module](../auth.md). Zero organizations is the normal state —
registration creates none; a user creates one explicitly with `POST /orgs.json`.

The full target behaviour (examples, edge cases, roadmap) is specified in
[`docs/agents/specs/orgs/`](../../specs/orgs/README.md). This page records what is **implemented**.
The owner-context mechanism used by owner-scoped modules (`OwnerContextGuard`, `@OwnerScoped()`,
`@MinOrgRole`, `parseOrgId()`) is described in
[Backend architecture](../../architecture/backend.md#owner-context-organizations).

## Tables

Created by `database/migrations/20261107120015-auth-create-organizations.ts` (runs after
`20261019120014`; `down()` drops the memberships table, then the organizations table).

| Table | Entity | Columns |
|---|---|---|
| `auth_organizations` | `entities/organization.entity.ts` (`Organization`) | `id`, `name` (`varchar(255)`, **not unique**), `created_at`, `updated_at` |
| `auth_organization_memberships` | `entities/organization-membership.entity.ts` (`OrganizationMembership`) | `id`, `organization_id`, `user_id`, `role` (`varchar(16)`: `user` / `admin` / `owner`), `created_at`, `updated_at` |

Constraints on `auth_organization_memberships`:

- unique index `idx_auth_organization_memberships_organization_id_user_id` on
  `(organization_id, user_id)` — at most one membership per user per organization; also the
  membership-check lookup;
- index `idx_auth_organization_memberships_user_id` — "list my organizations";
- **real** foreign keys (all three tables are owned by `auth`, unlike the module's logical user
  references): `organization_id` → `auth_organizations.id` and `user_id` → `auth_users.id`, both
  `ON DELETE RESTRICT`. A user or organization that still has a membership cannot be deleted.

There is no owner column: ownership lives only in the membership role. The "exactly one owner at
birth" rule is held by the service, not by the schema.

## `OrganizationService`

`auth/organization.service.ts`, exported by `AuthModule`. It is the **only** writer of
memberships; other modules read memberships only through it, never by querying the tables.

| Method | Behaviour |
|---|---|
| `create(userId, name)` | Writes the organization and its single `owner` membership in one `manager.transaction` (both rolled back on failure). The role is always `owner`, never taken from input. |
| `listForUser(userId)` | The user's organizations with their role in each, ordered by id (empty for zero organizations). |
| `findMembership(userId, orgId)` | The membership plus its organization, or `null` for a non-member / unknown organization. |
| `findRole(userId, orgId)` | Implements `OrganizationMembershipLookup`: one lookup on the unique key, `null` for a non-member (same cost for an unknown organization, so ids cannot be enumerated). |
| `rename(userId, orgId, name)` | Uniform 404 (`ownerNotFound()`) for a non-member, then uniform 403 (`orgRoleForbidden()`) below `admin`; last write wins among admins/owners. |

No global-admin bypass (`User.isAdmin` grants no organization access), no caching between
requests, and names are never logged.

### The port binding

`AuthModule` provides Core's `ORGANIZATION_MEMBERSHIP_LOOKUP` port with
`{ provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useExisting: OrganizationService }` and exports it
together with `OrganizationService`. `useExisting` keeps **one** service instance shared by the
controller and the global `OwnerContextGuard` (declared in `AppModule`), which resolves real roles
through it; `core/` still never imports `auth/`.

## Routes (`OrganizationController`)

`auth/organization.controller.ts` — thin, no path prefix, JWT-protected (no `@Public()`), not
owner-scoped (it *is* the organization). `:orgId` is read as a raw string and parsed only by
`parseOrgId()`; bodies come only through `@StrictBody()` (`OrganizationNameDto`: `name` only, so
`role` or `organizationId` in a body answer 400).

| Route | Cache class | Invalidates | Response |
|---|---|---|---|
| `GET /orgs.json` | `user-scoped` | — | `[organization]`, ordered by id |
| `POST /orgs.json` | `never` | `/orgs.json` | `201`, `organization` with `role: "owner"` |
| `GET /orgs/:orgId.json` | `user-scoped` | — | `organization` |
| `PATCH /orgs/:orgId.json` | `never` | `/orgs.json`, `/orgs/<id>.json` | `organization` |

- **Name rules** (`dto/organization-name.dto.ts`): trimmed, non-empty, at most 255 **code points**
  (`MaxCodePoints`, `core/string-validators.ts`), no Unicode control characters (`Cc`).
- **Uniform 404:** every miss — unknown, malformed (`1e3`, `01`, `abc`), foreign, non-member, a
  non-member global admin — answers the same 404 body.
- **Rename order:** 400 body → 404 membership → 403 role. The body is validated first, which is
  safe: the 400 depends only on the body and cannot enumerate organizations.
- **Response allowlist** (`organization-response.ts`, `serializeOrganization`): exactly
  `{ id, name, role, created_at, updated_at }`, where `role` is the caller's. Never member lists or
  other users' ids.
- **Cache:** the GETs send `X-Skip-Cache: true` / `Cache-Control: private, no-store`; the writes
  send `no-store` and, on success, `X-Cache-Invalidate` (`organization-invalidation.ts`; never
  `/orgs`, whose recursive clear would wipe every organization's tree). The proxy does not consume
  `X-Cache-Invalidate` yet (#33). Navi warms nothing: no organization route is public.

## Frontend

The frontend foundation (#29) resolves the owner context from the URL, remembers it per user,
gates controls by role and wires it to React. There are no organization pages, routes or context
switcher yet (#30); modules register their context-aware routes in #31. Base:
`frontend/assets/js/`.

### Routing (`utils/routing/`)

`routes.js` holds three ordered `[path, page key]` tables, matched top-to-bottom, plus a section
registry:

| Table | Matched against | Current rows |
|---|---|---|
| `ROUTES_PERSONAL` | the full path | citadel's pages (`/recover-password`, admin, account, `/` last) |
| `ROUTES_ORG_ONLY` | the rest after `/orgs/<id>` | none yet (#30 adds overview and edit) |
| `ROUTES_CONTEXT` | the path as Personal, or the rest after `/orgs/<id>` | none yet (modules, #31) |
| `SECTIONS_CONTEXT` | `[prefix, list path]` for context switches (`sectionTarget.js`) | none yet |

`HashRouteResolver.resolve()` returns `{ page, context }`. Lookup order: Personal-only routes →
`/orgs/<seg>` prefix → context-aware routes as Personal → `home`. Under a prefix, a **malformed
id** (anything outside `^[1-9][0-9]*$`, or above `2147483647` — the backend's `parseOrgId()` rule:
`0`, `007`, `abc`, `1e3`, `2147483648`) resolves to `{ page: 'not-found', context: PERSONAL }`
**without issuing any request**; a valid id tries organization-only routes, then context-aware
routes, with `{ kind: 'organization', orgId }` as context. `not-found` falls back to the home page
until #30 adds `NotFound`. `Router.extractContextParams(path, hash)` strips a valid `/orgs/<id>`
prefix so a page reads its params the same way in both contexts; `hashQuery.js` reads and builds
the `?…` part of a hash.

### Owner context (`utils/context/`)

`ownerContext.js`: `PERSONAL`, `organizationContext(orgId)`, `parseOrgId(segment)`,
`contextPath(context, '/x.json')` (API path, `/orgs/<id>/x.json` in an organization),
`contextHash(context, '/x')` (hash link), `landingFor(context)`, `isSameContext`, `hashPath`,
`splitOrgPrefix`, `stripContextPrefix`. **API clients take the context as an argument**, never
from module-level state: an ambient "current organization" would reopen the leak the backend guard
closes.

**Remembered context** (`ContextStorage.js`): `localStorage` key
`citadel_placeholder.context.<userId>`, storing the **organization id only** (or Personal); every
access is wrapped in `try`/`catch`, and it is **not** cleared on logout. `entryResolution.js`
applies it **at the entry point only** (an empty or root hash, after the session's org list
loaded) and **forgets a stale id** — one not in the loaded list — without any request about it;
`trackVisit` remembers the context of each visited context-aware page. The `userId` comes from the
`status.json` answer, forwarded by `AuthStatus` as `AuthEvents.emit(loggedIn, isAdmin, pending,
userId)` (event detail `{ loggedIn, isAdmin, pending, userId }`; `userId` is `null` unless logged
in).

### Permissions (`utils/permissions/orgPermissions.js`)

`can(role, action)` mirrors the backend `@MinOrgRole` matrix: `ACTIONS.WRITE` needs `user`;
`RENAME_ORGANIZATION` and `DELETE` need `admin` (`owner` ranks above both). It **fails closed**: a
`null`/unknown role (e.g. still loading) or an unknown action answers `false`, so the UI renders no
control rather than an optimistic one.

### Provider, hooks and controllers (`components/common/ownerContext/`)

`App.jsx` keeps the resolved route in state (`AppController.getRoute()`, updated on
`hashchange`) and mounts `OwnerContextProvider route={route}` around the page. The provider value
(`useOwnerContext()`) carries `context`, `page`, `userId`, `orgs`, `orgsLoaded`, `orgsError`,
`refreshOrgs`, `role` and `refreshRole`:

- **`role`** is `owner` in Personal, the listed organization's `role` otherwise, and `null` while
  the list loads or when the organization is not listed. There is no separate role request:
  `refreshRole` is the org-list refetch. `useCan(action)` is `can(role, action)` for the active
  context.
- **One org-list load per session** (`OrgListController`): `GET /orgs.json`
  (`client/OrganizationsClient.js`) on the first logged-in `AuthEvents` event of a user, never on
  navigation; a logout clears the list; a failed load sets `orgsError`; late answers from a
  previous session are ignored. Entry resolution runs after each session's first load.
- **Role refresh on `403`**: `ApiClient` emits `permission:forbidden`
  (`client/PermissionEvents.js`) on every `403` before throwing; `forbiddenRefreshEffect`
  refetches the list once per burst (an in-flight flag drops events arriving during a refresh).

`OrganizationsClient` covers list, create (`POST /orgs.json { name }`), show
(`GET /orgs/:orgId.json`) and rename (`PATCH /orgs/:orgId.json { name }`); callers pass the `orgId`
of the validated active context.

## Testing

- Unit: `auth/tests/organization.service.spec.ts`, `organization-name.dto.spec.ts`,
  `organization-response.spec.ts`, `organization-invalidation.spec.ts`,
  `core/tests/string-validators.spec.ts`.
- E2e (in-memory repos, `auth/tests/support/in-memory-organization-repos.ts` with a fake
  transaction manager): `organization.controller.{create,read,rename,not-found}.e2e-spec.ts` and
  `owner-scoped.e2e-spec.ts` (the guard over the real service, using the test-only
  `WidgetsTestController`; `buildAuthTestApp({ ownerContextGuard: true })`).
- Migration: `database/tests/auth-create-organizations-migration.spec.ts` (fake query runner).
- MySQL (`yarn test:integration`): `auth/tests/integration/organization.service.integration-spec.ts`
  proves what the in-memory repos cannot — the transaction and its rollback, the unique index and
  `ON DELETE RESTRICT`.
- Coverage: `OrganizationController` is in `KNOWN_CONTROLLERS`
  (`core/tests/support/route-discovery.ts`), so the cache-policy and cache-invalidation coverage
  specs check it.
- Frontend (Jasmine, `frontend/specs/`): `utils/routing/` (resolver order, malformed-id guard,
  `extractContextParams`, sections, hash query), `utils/context/`, `utils/permissions/`,
  `client/OrganizationsClientSpec.js`, `client/PermissionEventsSpec.js` and
  `components/common/ownerContext/`.
