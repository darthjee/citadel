# Issue: Organizations: frontend foundation (routing, context, permissions, client)

## Description

Part of epic #25 (Organizations: optional org ownership for domain data). Citadel is a project
template; organizations ship with it so derived projects can have domain data owned by an
organization instead of a single user. The target behaviour is specified in
`docs/agents/specs/orgs/` (hub: `README.md`), and the original implementation is mirrored under
`docs/agents/specs/orgs/code_sample/`, with the same paths as in the real codebase.

**Approach (applies to every sub-issue):** move the files from `code_sample/` into their real
location, then adapt them to citadel. Stay close to the original so fixes can flow between citadel
and its derived projects. Where a file already exists in citadel, reconcile the two (merge the
organization-related changes) rather than overwrite. Remove each `code_sample/` file once it has been
moved/reconciled, and fold what matters from the spec pages into the permanent docs
(e.g. `docs/agents/modules/auth/organizations.md`, `docs/agents/modules/auth.md`).
Cache, data-access and security reviews are decided during this issue's planning.

This issue implements the **frontend foundation** for organizations: routing in an organization
context, the active owner context, permissions and the API client, wired into the app with **no
visible change** yet. Organization pages, the context switcher and the header come in #30.

Depends on #28 (merged): it builds against the real `/orgs` API.

Spec references: `frontend.md`, `edge-cases.md` (stale context, zero organizations),
`code-sample-frontend.md` sections 1–5.

## Problem

- The frontend has no notion of an owner context: every hash route is personal, and there is no way
  to address `#/orgs/:orgId/<module>/...`, remember the last organization, or know the caller's role.
- The sample cannot be dropped in as-is:
  - `HashRouteResolver.getPage()` becomes `resolve()` returning `{ page, context }`, but the sample
    ships no `App`/`AppController` changes, so citadel's `AppController` breaks unless it is rewired.
  - `ContextStorage` keys the remembered organization by user id, and the sample's
    `AuthStatus`/`AuthEvents` read `userId` from `status.json`. Citadel's backend answers
    `{ loggedIn: true, isAdmin }` with no `userId`.
  - `routes.js` lists ward's bank routes in `ROUTES_CONTEXT`/`SECTIONS_CONTEXT`, and its personal and
    organization-only tables point to organization pages that only arrive in #30.
  - `orgPermissions.js` `ACTIONS` includes bank-only actions (`UNDO_PAYMENT`,
    `EDIT_PAYMENT_TRANSACTION`, `MANAGE_ACCOUNTS`).
  - Storage keys use ward's `ward.` prefix.
- The sample has no specs for several of the files ported here (`OrganizationsClient`,
  `PermissionEvents`, the provider, hooks and controllers, and the `ApiClient`/`AuthStatus` changes).

## Expected Behavior

- **Routing.** A module registers its paths once in `ROUTES_CONTEXT` and they resolve both as
  personal (`#/<module>/...`) and under an organization (`#/orgs/:orgId/<module>/...`).
  `HashRouteResolver.resolve()` returns `{ page, context }`, with the lookup order: personal-only
  routes (full path) → `/orgs/<id>` prefix (organization-only, then context routes) → context routes
  as personal → `home`. A malformed id (outside `^[1-9][0-9]*$` or above `2147483647`) resolves to
  `not-found` **without issuing a request**, mirroring the backend's `parseOrgId()`.
  `Router.extractContextParams()` strips the `/orgs/<id>` prefix so pages read their params
  identically in both contexts.
- **Context.** `contextPath(context, '/x.json')` builds API paths and `contextHash(context, '/x')`
  builds hash links; API clients take the context as an argument, never from global state.
  `ContextStorage` remembers **only the organization id** under
  `citadel_placeholder.context.<userId>`, wraps every access in `try`/`catch`, and is not cleared on
  logout. `entryResolution` applies the remembered context at the entry point only, and forgets a
  stale id that is no longer in the loaded organization list.
- **Permissions.** `can(role, action)` mirrors the backend role matrix and fails closed: a `null` or
  unknown role, or an unknown action, answers `false`. Actions: `WRITE` (`user`),
  `RENAME_ORGANIZATION` and `DELETE` (`admin`).
- **Provider.** `OwnerContextProvider` is mounted in the app. On login it loads `GET /orgs.json` once
  per session (`OrgListController`), runs entry resolution, and exposes `context`, `page`, `orgs`,
  `role` and `refreshRole`. `role` is `owner` in the personal context, the organization's role from
  the list otherwise, and `null` while loading or when the organization is not listed. There is no
  separate role request: `refreshRole` re-fetches the list.
- **Role refresh on 403.** `ApiClient` emits `permission:forbidden` (`PermissionEvents`) on any
  `403` before throwing; `forbiddenRefreshEffect` refreshes the role once per burst.
- **Client.** `OrganizationsClient` knows the four calls (list, create, read, rename). `ApiClient`
  sends a request without a body (e.g. a GET) with no `body` option.
- **Backend `status.json`.** For an approved, logged-in user it answers
  `{ loggedIn: true, isAdmin, userId }` (the caller's own id only); every other branch is unchanged
  and carries no `userId`. `AuthStatus` forwards it through `AuthEvents`.
- **No visible change.** Until #30 adds pages, the switcher and `NotFound`, the app renders exactly
  as today; `not-found` falls back to the existing default page.

## Solution

### Port from `code_sample/frontend/`

- Routing (`utils/routing/`): reconcile `Router`, `HashRouteResolver` (`redirects` and `Route` are
  identical); add `routes.js`, `hashQuery.js`, `sectionTarget.js`.
- Context (`utils/context/`): `ContextStorage.js`, `entryResolution.js`, `ownerContext.js`.
- Permissions: `utils/permissions/orgPermissions.js`.
- Client (`client/`): add `OrganizationsClient.js`, `PermissionEvents.js`; reconcile `ApiClient`,
  `ApiError`, `AuthEvents`, `AuthSession`, `AuthStatus`, `isSessionExpired` (`pickDefined` is
  identical). Keep citadel's `citadel_placeholder_refresh_token` key in `AuthSession`.
- Provider and hooks (`components/common/ownerContext/`): `OwnerContextProvider.jsx`,
  `hooks/useCan.js`, `hooks/useOwnerContext.js`, `controllers/OrgListController.js`,
  `controllers/forbiddenRefreshEffect.js`.
- `specs/support/jsx-loader.mjs` (identical) and the sample specs: routing (`HashRouteResolver`,
  `Router`, `Route`, `redirects`, `sectionTarget`, `hashQuery`), context (`ContextStorage`,
  `entryResolution`, `ownerContext`) and `orgPermissions`.

### Adaptations

- `routes.js`: `ROUTES_CONTEXT` and `SECTIONS_CONTEXT` start **empty** (#31 adds the example module's
  rows). `ROUTES_PERSONAL` keeps citadel's existing routes; the organization routes (`/orgs/new`
  → `org-new` in `ROUTES_PERSONAL`, `org-overview` and `org-edit` in `ROUTES_ORG_ONLY`) are added by
  #30 together with their pages, so `ROUTES_ORG_ONLY` also starts empty. The resolver specs use the
  `contextRoutes` option with fixture routes.
- `orgPermissions.js`: drop `UNDO_PAYMENT`, `EDIT_PAYMENT_TRANSACTION` and `MANAGE_ACCOUNTS`.
- `ContextStorage`: key prefix `citadel_placeholder.context.` instead of `ward.context.`.
- `App`/`AppController`: switch from `getPage()` to `resolve()`, keep `{ page, context }` as the
  route, pass `page` to the existing page rendering, and mount `OwnerContextProvider` with the route.
  Update `AppSpec`/`AppControllerSpec` and every other caller of `getPage()`.
- Comments mentioning ward or bank are made generic.

### Backend

- `session-status.service.ts` adds `userId` to the approved branch (and the `AuthStatus` type);
  spec updated. Document the field in the auth endpoint docs. The id is the caller's own, so no new
  data is exposed.

### New specs

Specs for every ported file the sample leaves uncovered, in citadel's existing spec style:
`OrganizationsClient`, `PermissionEvents`, `OwnerContextProvider` (`buildOwnerContextValue`,
`resolveRole`), `useCan`, `useOwnerContext`, `OrgListController`, `forbiddenRefreshEffect`, and the
reconciled `ApiClient` (403 event, request without body), `AuthEvents` and `AuthStatus` (`userId`).

### Cleanup and docs

- Delete every `code_sample/` file this issue ports and update `code-sample-frontend.md` /
  `code-sample.md`.
- Fold the frontend mechanism (route tables, context helpers and the "clients take the context as an
  argument" rule, remembered context, `can()` failing closed, role refresh on 403) into the permanent
  docs (`docs/agents/modules/auth/organizations.md`, the frontend architecture doc).

### Out of scope

Organization pages and their routes, the context switcher and header, `NotFound` and
`PermissionDenied` (#30); the example owner-scoped module and its routes (#31).

### Testing

Ported and new Jasmine specs; frontend suite and lint green; backend suite green for the
`status.json` change.

## Benefits

- Derived projects get context-aware routing, permissions and the API client in place, so #30 only
  adds UI and #31 only registers routes.
- The remembered context and role refresh work end to end from day one, with no visible change.
- Clients receiving the context as an argument and `can()` failing closed keep the frontend from
  reopening the leaks the backend guard closes.
- Staying close to the original keeps fixes portable between citadel and its derived projects.
