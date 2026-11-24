# Organizations - Code Sample - Frontend

Part 3 of 3. Index: [Code Sample](./code-sample.md).
Previous: [Migrations](./code-sample-migrations.md).

**57 files plus 1 directory.** Every path below was read from the repository tree on branch
`main`.

## What this part covers

| Group | Files |
|---|---|
| Routing | 7 |
| Context | 3 |
| Permissions | 1 |
| Provider, hooks, controllers | 5 |
| Client layer | 9 |
| Organizations pages | 10 |
| Header and switcher | 4 |
| Shared pieces | 2 |
| Specs | 16 |

The order follows the dependency chain: routing decides the context, the context layer builds the
paths, permissions decide what renders, then the provider wires it to React, the client makes the
calls, and the pages consume it.

## 1. Routing

Base: `frontend/assets/js/utils/routing/`.

| File | Role |
|---|---|
| [routes.js](./code_sample/frontend/assets/js/utils/routing/routes.js) | `ROUTES_PERSONAL`, `ROUTES_ORG_ONLY`, `ROUTES_CONTEXT` and `SECTIONS_CONTEXT` |
| [HashRouteResolver.js](./code_sample/frontend/assets/js/utils/routing/HashRouteResolver.js) | `HashRouteResolver.resolve()` - returns `{ page, context }` |
| [Router.js](./code_sample/frontend/assets/js/utils/routing/Router.js) | `extractContextParams()` and navigation |
| [Route.js](./code_sample/frontend/assets/js/utils/routing/Route.js) | The `Route` type - pattern matching and params |
| [sectionTarget.js](./code_sample/frontend/assets/js/utils/routing/sectionTarget.js) | `switchTargetFor()` - where a context switch lands |
| [hashQuery.js](./code_sample/frontend/assets/js/utils/routing/hashQuery.js) | `hashQuery` / `withHashQuery` for the `?...` part of the hash |
| [redirects.js](./code_sample/frontend/assets/js/utils/routing/redirects.js) | Route redirects - imported by the router |

`HashRouteResolver.js` is where the malformed-id guard lives: a segment outside `^[1-9][0-9]*$`, or
above `2147483647`, resolves to `not-found` **without issuing a request**. That is the client mirror
of the backend's `parseOrgId()`.

The three route tables are the mechanism that lets a module register its paths **once** and work in
both contexts. `ROUTES_CONTEXT` entries never mention `orgs`.

## 2. Context

Base: `frontend/assets/js/utils/context/`.

| File | Role |
|---|---|
| [ownerContext.js](./code_sample/frontend/assets/js/utils/context/ownerContext.js) | `contextPath()`, `contextHash()`, `landingFor()` |
| [ContextStorage.js](./code_sample/frontend/assets/js/utils/context/ContextStorage.js) | The remembered context under `ward.context.<userId>` |
| [entryResolution.js](./code_sample/frontend/assets/js/utils/context/entryResolution.js) | Applies the remembered context at the entry point |

`contextPath(context, '/x.json')` builds API paths and `contextHash(context, '/x')` builds hash
links. **API clients take the context as an argument** - never from global state. A client reading a
module-level "current organization" would make the context ambient and reopen the leak the backend
guard closes.

`ContextStorage.js` stores the **organization id only**, wraps every access in `try` / `catch`, and
does **not** clear on logout. A stale id is dropped by `entryResolution.js` when it is not in the
loaded list.

## 3. Permissions

| File | Role |
|---|---|
| [frontend/assets/js/utils/permissions/orgPermissions.js](./code_sample/frontend/assets/js/utils/permissions/orgPermissions.js) | `ROLES`, `ACTIONS`, `can(role, action)` - mirrors the backend matrix and **fails closed** |

Actions: `WRITE` (`user`), `UNDO_PAYMENT`, `EDIT_PAYMENT_TRANSACTION`, `MANAGE_ACCOUNTS`,
`RENAME_ORGANIZATION`, `DELETE` (all `admin`).

`can()` answering `false` for a `null` or unknown role is the reason the UI renders nothing while
the role is still loading, instead of optimistically showing controls.

## 4. Provider, hooks, controllers

Base: `frontend/assets/js/components/common/ownerContext/`.

| File | Role |
|---|---|
| [OwnerContextProvider.jsx](./code_sample/frontend/assets/js/components/common/ownerContext/OwnerContextProvider.jsx) | The provider; `buildOwnerContextValue` adds `role` and `refreshRole` |
| [hooks/useOwnerContext.js](./code_sample/frontend/assets/js/components/common/ownerContext/hooks/useOwnerContext.js) | Reads the active context |
| [hooks/useCan.js](./code_sample/frontend/assets/js/components/common/ownerContext/hooks/useCan.js) | `useCan(action)` for the active context |
| [controllers/OrgListController.js](./code_sample/frontend/assets/js/components/common/ownerContext/controllers/OrgListController.js) | Loads `GET /orgs.json` once per session; exposes `refreshOrgs` |
| [controllers/forbiddenRefreshEffect.js](./code_sample/frontend/assets/js/components/common/ownerContext/controllers/forbiddenRefreshEffect.js) | Refreshes the role on a `403`, collapsing a burst into one refresh |

`role` is **`owner` in Personal**, the active organization's role from the org list otherwise, and
`null` while loading or when the organization is not listed. There is **no separate role request** -
`refreshRole` is the org-list refetch.

`forbiddenRefreshEffect.js` holds the in-flight flag. Without it, a page with five forbidden
requests would trigger five list refetches.

## 5. Client layer

Base: `frontend/assets/js/client/`.

| File | Role |
|---|---|
| [OrganizationsClient.js](./code_sample/frontend/assets/js/client/OrganizationsClient.js) | The four organization calls: list, create, read, rename |
| [ApiClient.js](./code_sample/frontend/assets/js/client/ApiClient.js) | The HTTP layer; emits `permission:forbidden` on any `403` **before** throwing |
| [ApiError.js](./code_sample/frontend/assets/js/client/ApiError.js) | The error type built from the backend's standard body |
| [PermissionEvents.js](./code_sample/frontend/assets/js/client/PermissionEvents.js) | `emitForbidden()`, `onForbidden()` - the `permission:forbidden` window event |
| [AuthSession.js](./code_sample/frontend/assets/js/client/AuthSession.js) | Session state the provider depends on |
| [AuthStatus.js](./code_sample/frontend/assets/js/client/AuthStatus.js) | The `status.json` check that drives the pending gate |
| [AuthEvents.js](./code_sample/frontend/assets/js/client/AuthEvents.js) | Auth event bus - login and logout trigger the org list load and clear |
| [isSessionExpired.js](./code_sample/frontend/assets/js/client/isSessionExpired.js) | The `401` session-expired path |
| [pickDefined.js](./code_sample/frontend/assets/js/client/pickDefined.js) | Drops `undefined` keys from request bodies - used when building the `{ name }` payload |

`OrganizationsClient.js` exists and is the file that knows the four paths. `ApiClient.js` is the
only place that turns a `403` into a role refresh, which is why every page benefits from it.

## 6. Organizations pages

Base: `frontend/assets/js/components/resources/organizations/pages/`.

### Pages

| File | Role |
|---|---|
| [OrganizationNew.jsx](./code_sample/frontend/assets/js/components/resources/organizations/pages/OrganizationNew.jsx) | Create form - route `#/orgs/new` |
| [OrganizationOverview.jsx](./code_sample/frontend/assets/js/components/resources/organizations/pages/OrganizationOverview.jsx) | Overview: name, role, Rename link - route `#/orgs/:orgId` |
| [OrganizationEdit.jsx](./code_sample/frontend/assets/js/components/resources/organizations/pages/OrganizationEdit.jsx) | Rename form - route `#/orgs/:orgId/edit` |

### Controllers

| File | Role |
|---|---|
| [controllers/OrganizationNewController.js](./code_sample/frontend/assets/js/components/resources/organizations/pages/controllers/OrganizationNewController.js) | Controller behind the create form |
| [controllers/OrganizationEditController.js](./code_sample/frontend/assets/js/components/resources/organizations/pages/controllers/OrganizationEditController.js) | Controller behind the rename form; shows `PERMISSION_DENIED_MESSAGE` on a `403` |
| [controllers/OrganizationFormController.js](./code_sample/frontend/assets/js/components/resources/organizations/pages/controllers/OrganizationFormController.js) | Form state and submit wiring shared by create and rename |
| [controllers/OrganizationLoader.js](./code_sample/frontend/assets/js/components/resources/organizations/pages/controllers/OrganizationLoader.js) | Loader for the overview page |
| [controllers/navigation.js](./code_sample/frontend/assets/js/components/resources/organizations/pages/controllers/navigation.js) | Navigation targets between the three pages |

### Helpers

| File | Role |
|---|---|
| [helpers/OrganizationFormHelper.jsx](./code_sample/frontend/assets/js/components/resources/organizations/pages/helpers/OrganizationFormHelper.jsx) | Form markup for create and rename |
| [helpers/OrganizationOverviewHelper.jsx](./code_sample/frontend/assets/js/components/resources/organizations/pages/helpers/OrganizationOverviewHelper.jsx) | Overview markup - name, role, Rename link |

The `OrganizationFormController.js` is the piece that makes create and rename share one
implementation. If it is missing, both forms have to be rewritten rather than copied.

## 7. Header and switcher

Base: `frontend/assets/js/components/common/header/`.

| File | Role |
|---|---|
| [Header.jsx](./code_sample/frontend/assets/js/components/common/header/Header.jsx) | Hosts the switcher, left of the header after the brand |
| [contextSwitcher/ContextSwitcher.jsx](./code_sample/frontend/assets/js/components/common/header/contextSwitcher/ContextSwitcher.jsx) | The switcher: Personal, the organizations, **+ Create organization** |
| [contextSwitcher/controllers/ContextSwitcherController.js](./code_sample/frontend/assets/js/components/common/header/contextSwitcher/controllers/ContextSwitcherController.js) | Switcher state: the org list, the active entry, the error when `/orgs.json` fails |
| [contextSwitcher/helpers/ContextSwitcherHelper.jsx](./code_sample/frontend/assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelper.jsx) | Switcher markup - truncation, the checked item, the `title` attribute |

`Header.jsx` also mounts the login/logout nav, which reads from `header/controllers/`,
`header/helpers/` and `header/hooks/`. Copy those **three directories** too if the replica needs the
full header - they are not specific to organizations.

## 8. Shared pieces

| File | Role |
|---|---|
| [frontend/assets/js/components/common/PermissionDenied.jsx](./code_sample/frontend/assets/js/components/common/PermissionDenied.jsx) | Exports `PERMISSION_DENIED_MESSAGE`, shown by the rename form on a `403` |
| [frontend/assets/js/components/common/notFound/NotFound.jsx](./code_sample/frontend/assets/js/components/common/notFound/NotFound.jsx) | The generic not-found view, offering "Go to Personal" |

`NotFound.jsx` is also the view that **forgets a remembered context id** when a `404` or a malformed
id is hit.

## 9. Specs

| File | Covers |
|---|---|
| [frontend/specs/support/jsx-loader.mjs](./code_sample/frontend/specs/support/jsx-loader.mjs) | The ESM loader every frontend spec needs - without it none runs |
| [specs/assets/js/components/resources/organizations/pages/controllers/OrganizationNewControllerSpec.js](./code_sample/frontend/specs/assets/js/components/resources/organizations/pages/controllers/OrganizationNewControllerSpec.js) | The create controller |
| [specs/assets/js/components/resources/organizations/pages/controllers/OrganizationEditControllerSpec.js](./code_sample/frontend/specs/assets/js/components/resources/organizations/pages/controllers/OrganizationEditControllerSpec.js) | The rename controller |
| [specs/assets/js/components/resources/organizations/pages/controllers/OrganizationLoaderSpec.js](./code_sample/frontend/specs/assets/js/components/resources/organizations/pages/controllers/OrganizationLoaderSpec.js) | The overview loader |
| [specs/assets/js/components/resources/organizations/pages/helpers/OrganizationFormHelperSpec.js](./code_sample/frontend/specs/assets/js/components/resources/organizations/pages/helpers/OrganizationFormHelperSpec.js) | The form helper |
| [specs/assets/js/components/resources/organizations/pages/helpers/OrganizationOverviewHelperSpec.js](./code_sample/frontend/specs/assets/js/components/resources/organizations/pages/helpers/OrganizationOverviewHelperSpec.js) | The overview helper |
| [specs/assets/js/utils/routing/HashRouteResolverSpec.js](./code_sample/frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js) | Resolution order, `/orgs/<seg>` stripping, the `2147483647` bound |
| [specs/assets/js/utils/routing/RouterSpec.js](./code_sample/frontend/specs/assets/js/utils/routing/RouterSpec.js) | `extractContextParams()` |
| [specs/assets/js/utils/routing/RouteSpec.js](./code_sample/frontend/specs/assets/js/utils/routing/RouteSpec.js) | The `Route` type |
| [specs/assets/js/utils/routing/sectionTargetSpec.js](./code_sample/frontend/specs/assets/js/utils/routing/sectionTargetSpec.js) | Segment-boundary matching, query string dropped |
| [specs/assets/js/utils/routing/hashQuerySpec.js](./code_sample/frontend/specs/assets/js/utils/routing/hashQuerySpec.js) | Hash query read and write |
| [specs/assets/js/utils/routing/redirectsSpec.js](./code_sample/frontend/specs/assets/js/utils/routing/redirectsSpec.js) | Redirects |
| [specs/assets/js/utils/context/ContextStorageSpec.js](./code_sample/frontend/specs/assets/js/utils/context/ContextStorageSpec.js) | Key `ward.context.<userId>`, org id only, `try`/`catch` fallback |
| [specs/assets/js/utils/context/entryResolutionSpec.js](./code_sample/frontend/specs/assets/js/utils/context/entryResolutionSpec.js) | Entry point only, stale id forgotten |
| [specs/assets/js/utils/context/ownerContextSpec.js](./code_sample/frontend/specs/assets/js/utils/context/ownerContextSpec.js) | `contextPath()`, `contextHash()`, `landingFor()` |
| [specs/assets/js/utils/permissions/orgPermissionsSpec.js](./code_sample/frontend/specs/assets/js/utils/permissions/orgPermissionsSpec.js) | `can()` failing closed |

Full paths are spelled out in every link above. Copy the specs directory tree whole if that is
easier than file by file.

## Minimum set for a working frontend

If the goal is runnable pages rather than a complete mirror:

1. **Routing** (6 of 7): `routes.js`, `HashRouteResolver.js`, `Router.js`, `Route.js`,
   `sectionTarget.js`, `hashQuery.js`. `redirects.js` is imported by the router but is not
   organizations-specific.
2. **Context**: `ownerContext.js`, `ContextStorage.js`, `entryResolution.js`.
3. **Permissions**: `orgPermissions.js`.
4. **Provider**: `OwnerContextProvider.jsx`, `useOwnerContext.js`, `useCan.js`,
   `OrgListController.js`, `forbiddenRefreshEffect.js`.
5. **Client** (7 of 9): `OrganizationsClient.js`, `ApiClient.js`, `ApiError.js`,
   `PermissionEvents.js`, `AuthSession.js`, `AuthStatus.js`, `AuthEvents.js`.
6. **Pages**: the three pages, the five controllers, the two helpers.
7. **Switcher**: `ContextSwitcher.jsx`, `ContextSwitcherController.js`,
   `ContextSwitcherHelper.jsx`, `Header.jsx`.
8. **Shared**: `NotFound.jsx`, `PermissionDenied.jsx`.

That is **38 files**: 6 + 3 + 1 + 5 + 7 + 10 + 4 + 2 = 38.

The remaining 19 of the 57 are the 16 specs, plus `redirects.js`, `isSessionExpired.js` and
`pickDefined.js`. Adding those three to the minimum set brings it to 41; the specs close the gap to
57.

## Checklist

| Group | Files | Done |
|---|---|---|
| Routing | 7 | |
| Context | 3 | |
| Permissions | 1 | |
| Provider, hooks, controllers | 5 | |
| Client layer | 9 | |
| Pages | 10 | |
| Header and switcher | 4 | |
| Shared pieces | 2 | |
| Specs | 16 | |

## Not in this part

| Item | Why |
|---|---|
| `Header.jsx` subdirectories | `header/controllers/`, `header/helpers/`, `header/hooks/` carry the login/logout nav. Needed for a working header, not organizations-specific |
| `utils/validation/fieldValidators.js` and `formValidators.js` | Used by the organization forms. Add them if form validation is replicated |
| `App.jsx`, `main.jsx`, `AppController.js` | Entry point and route dispatcher. Project-wide |
| `LoginModalEvents.js`, `LoginModalController`, `useLoginModal`, `useDeviceCountdown` | The login modal. Only needed if the replica keeps the login flow |
| `utils/locale/` | Locale loading. Not referenced by the organization pages |
| Build configuration | `vite.config.*`, `package.json`, `eslint.config.mjs`. `specs/support/jsx-loader.mjs` is listed because no spec runs without it |
