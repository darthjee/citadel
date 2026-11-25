# Organizations - Frontend

Hub: [Organizations](README.md).

## Summary

The organization UI is a **context mechanism**, not a screen set.

| Piece | What it does |
|---|---|
| **Routing** | Derives `{ page, context }` from the hash. The context is in the URL |
| **Context switcher** | Personal plus the organizations, in the header |
| **`ContextStorage`** | Remembers the last context, per user |
| **`entryResolution`** | Applies the remembered context at the entry point only |
| **`OwnerContextProvider`** | Supplies the active context, the role and `refreshRole` |
| **`useCan(action)`** | Decides what to render for the current role |
| **`OrgListController`** | Loads `GET /orgs.json` once per session |
| **`forbiddenRefreshEffect`** | Refreshes the role on a `403`, once per burst |

The whole mechanism exists so that a domain module registers its paths **once** and works in both
contexts, with no module-specific knowledge of organizations.

## Routing

Base: `frontend/assets/js/utils/routing/`.

### The hash is the source of truth

| Context | Hash |
|---|---|
| Personal | `#/<module>/...` |
| Organization | `#/orgs/:orgId/<module>/...` |
| Organization pages | `#/orgs/new`, `#/orgs/:orgId`, `#/orgs/:orgId/edit` |

Because the context lives in the URL, **two browser tabs can work on different contexts at the same
time**. It also means a link is shareable and a reload restores the same context.

### The four route tables

`routes.js` registers each module's paths **once**, and the resolver composes them per context.

| Table | Meaning |
|---|---|
| `ROUTES_PERSONAL` | Paths that exist only in Personal |
| `ROUTES_ORG_ONLY` | Paths that exist only under an organization |
| `ROUTES_CONTEXT` | Paths that exist in **both** contexts - the ordinary case |
| `SECTIONS_CONTEXT` | Sections reachable in both contexts, for switching |

`ROUTES_CONTEXT` entries **never mention `orgs`**. That is the point: the same entry produces
`#/bank/accounts` in Personal and `#/orgs/1/bank/accounts` in an organization.

### Resolution order

`HashRouteResolver.resolve()` returns `{ page, context }`, and the order matters.

1. Match against **personal-only** routes first.
2. If the hash starts with `/orgs/<seg>`, validate `<seg>` and strip it, then match the remainder
   against the context and organization-only routes.
3. Fall back to `home`.

Personal first is deliberate: a personal page named like an organization page must not be swallowed
by the organization prefix.

### The malformed-id guard

The segment must match **`^[1-9][0-9]*$`** and must not exceed **`2147483647`**.

| Hash | Result |
|---|---|
| `#/orgs/7/bank/accounts` | Resolves, context = organization 7 |
| `#/orgs/0/...` | `not-found`, **no request issued** |
| `#/orgs/007/...` | `not-found` |
| `#/orgs/abc/...` | `not-found` |
| `#/orgs/1e3/...` | `not-found` |
| `#/orgs/2147483648/...` | `not-found` |

Resolving to `not-found` **without issuing a request** is the point: a malformed id never reaches
the API. It mirrors the backend's `parseOrgId()`, but it is **not** the security boundary - a direct
call bypasses it entirely. See [Owner context](./owner-context.md).

### `extractContextParams()`

Pulls `:orgId` and the remaining params out of the stripped path, so the page component receives a
plain params object and never parses the hash itself.

### `sectionTargetFor()`

Decides where a context switch lands.

| Rule | Detail |
|---|---|
| Segment-boundary matching | `/bank` matches `/bank/...` but not `/banking` |
| Query string dropped | The `?...` part of the hash does not affect matching |
| Fallback | The module's landing path when the current section does not exist in the target context |

This is why switching from a Personal page that has no organization equivalent lands somewhere
valid instead of on a broken route.

## `contextPath` and `contextHash`

Two builders, both taking the context as an **argument**.

| Function | Produces |
|---|---|
| `contextPath(context, '/x.json')` | The API path: `/x.json` in Personal, `/orgs/1/x.json` in an organization |
| `contextHash(context, '/x')` | The hash link: `#/x` or `#/orgs/1/x` |
| `landingFor(context)` | The context's landing page |

**Clients take the context as an argument, never from a module-level "current organization".**
An ambient current context would reopen the leak the backend guard closes, and would make two tabs
in different contexts interfere.

## Remembered context

### `ContextStorage`

| Property | Value |
|---|---|
| Key | `ward.context.<userId>` |
| Stored value | The **organization id only** - no name, no role, no cached body |
| Failure mode | Every access wrapped in `try` / `catch`, falling back to Personal |
| Cleared on logout | **No** |

Storing only the id is what makes a stale value cheap: nothing to invalidate, nothing to keep in
sync, and no data disclosure if storage is read by someone else.

Not clearing on logout is deliberate - the rules in `entryResolution` handle a stale id instead.

### `entryResolution`

Applied **only** at the entry point.

| Rule | Detail |
|---|---|
| Applies at | `''` or `#/` - the bare entry |
| Explicit URL wins | Any real hash is respected, and the remembered context is not applied |
| Stale id | Not present in the loaded organization list → **forgotten**, and Personal is used |
| Not attempted | A stale id is never used to issue a request |

So a remembered organization that no longer exists produces Personal, not a `404`.

## The provider

Base: `frontend/assets/js/components/common/ownerContext/`.

### `OwnerContextProvider.jsx`

`buildOwnerContextValue` assembles the context value and adds `role` and `refreshRole`.

| Field | Source |
|---|---|
| The active context | The resolved hash |
| `role` | **`owner` in Personal**; the organization's role from the org list otherwise; `null` while loading or when the organization is not listed |
| `refreshRole` | The org-list refetch - there is **no separate role request** |

`role: 'owner'` in Personal is what removes the need for a personal branch anywhere in the
permission code.

`null` while loading is what makes `can()` render nothing until the role is known, instead of
optimistically showing controls.

### `useOwnerContext()`

Reads the active context. Any component needing the current owner uses this, never the hash.

### `useCan(action)`

Returns whether the current role may perform `action`. It delegates to `can(role, action)` from
`utils/permissions/orgPermissions.js`.

```
useCan(ACTIONS.RENAME_ORGANIZATION)   // admin and owner -> true, user -> false
```

**Hidden controls are not a security boundary.** Every action a hidden control would perform is
refused by the backend. See [Roles](./roles.md).

## `OrgListController`

| Property | Detail |
|---|---|
| Loads | `GET /orgs.json` |
| Frequency | Once per session |
| Exposes | `refreshOrgs` |
| Empty list | A valid result - renders Personal plus the create entry |
| Failure | The switcher shows an error; the rest of the app still works in Personal |

`refreshOrgs` is also what `refreshRole` calls. That is why a role change costs one list request,
not a dedicated endpoint.

## `forbiddenRefreshEffect`

The recovery path for a stale role.

```
ApiClient receives 403
  -> emits 'permission:forbidden' BEFORE throwing
  -> forbiddenRefreshEffect sees the event
  -> if a refresh is already in flight: ignore
  -> otherwise: refreshOrgs()
  -> the role updates, the controls update
```

Holds an **in-flight flag** so a page with five forbidden requests produces **one** refresh, not
five. Without it, one role change would trigger N list requests, and each of the N `403`s another.

The `403` **is** the signal. There is no polling, no push and no TTL-based refresh documented for
this.

### The visible sequence

1. User holds `admin`. The UI shows Rename.
2. The role drops to `user` in the database.
3. User clicks Rename → **`403`**.
4. The event fires, the list refetches, the role updates.
5. Rename disappears.

Until step 3 the UI offers an action the backend will refuse. That is UX lag, not a security hole.

## The context switcher

Base: `frontend/assets/js/components/common/header/contextSwitcher/`.

| Element | Behaviour |
|---|---|
| **Personal** | Always present, always first |
| **Each organization** | The caller's organizations, from the org list |
| **+ Create organization** | Present regardless of how many organizations exist |
| Long names | Truncated visually; the `title` attribute carries the full name |
| Active entry | Marked as checked |
| `/orgs.json` failure | An error state inside the switcher |

Positioned in the header, left of the header content after the brand.

### Switching

| From → To | Lands on |
|---|---|
| Personal → organization | The equivalent section if it exists, otherwise the organization landing |
| Organization → Personal | The equivalent section if it exists, otherwise the Personal landing |
| Organization → another organization | Same rule, per organization |

`sectionTargetFor()` decides, using segment-boundary matching. The switch writes the new id to
`ContextStorage` and navigates.

## The organization pages

Base: `frontend/assets/js/components/resources/organizations/pages/`.

| Route | Page | Purpose |
|---|---|---|
| `#/orgs/new` | `OrganizationNew.jsx` | Create form |
| `#/orgs/:orgId` | `OrganizationOverview.jsx` | Name, role, Rename link |
| `#/orgs/:orgId/edit` | `OrganizationEdit.jsx` | Rename form |

### Controllers

| File | Role |
|---|---|
| `OrganizationNewController.js` | The create submit path |
| `OrganizationEditController.js` | The rename submit path, and the `403` message |
| `OrganizationFormController.js` | Shared form state and submit wiring |
| `OrganizationLoader.js` | The overview load path |
| `navigation.js` | Targets between the three pages |

`OrganizationFormController.js` is what makes create and rename share one implementation. Without
it, both forms have to be duplicated.

### On a `403` in the rename form

`OrganizationEditController` shows `PERMISSION_DENIED_MESSAGE` - the constant exported by
`components/common/PermissionDenied.jsx`. A `404` resolves to the generic not-found view instead,
which offers "Go to Personal".

## After a write

| Action | What the UI does |
|---|---|
| Create | `refreshOrgs()` so the switcher includes the new organization, then navigates to its overview |
| Rename | `refreshOrgs()` so the switcher shows the new name; the overview re-reads |

Both writes invalidate and refetch rather than patching local state. The list is small and the
network call is cheap, so the simpler path wins over local reconciliation.

## Role in Personal

| Context | `role` |
|---|---|
| Personal | **`owner`** |
| Organization, listed | The organization's role |
| Organization, not listed | `null` |
| While the list is loading | `null` |

Because Personal is `owner`, `useCan(ACTIONS.MANAGE_ACCOUNTS)` is `true` in Personal without any
special case. That is the whole reason the personal context needs no branch in the permission layer.

## Two tabs

| Situation | Behaviour |
|---|---|
| Tab A in Personal, Tab B in organization 1 | Both work; neither overwrites the other |
| Tab A creates an organization | Tab B's switcher is stale until it refreshes |
| Tab A renames | Tab B, if on the same organization, shows the old name until reload |

`ContextStorage` holds **one** id per user - the last one used. It does not coordinate between tabs
beyond that.

## What the frontend does not do

| Not done | Where it belongs |
|---|---|
| Enforce permissions | The backend. The UI only decides what to render |
| Cache organization data beyond the org list | The proxy, via `user-scoped` |
| Parse `:orgId` for security | The backend. The client guard is UX and optimisation |
| Validate the `name` authoritatively | The backend. The form may pre-check, the server decides |
| Poll for role changes | Nothing polls; the `403` is the signal |
| Remove members | Not built (#82) |
| Manage roles | Not built (#82) |

## What is not documented in the repository

The project documentation states the routing tables, the resolver, the storage rules, the provider
fields, `useCan`, `OrgListController`, `forbiddenRefreshEffect` and the three pages. It does **not**
contain:

- the **source** of any file in `frontend/assets/js/`;
- how `App.jsx` / `AppController.js` select which resolver branch to run;
- the exact form validation on the client, beyond the backend's `name` rules;
- the in-flight window used by `forbiddenRefreshEffect` to collapse a burst;
- whether the org list refreshes on login, on window focus, or only on demand;
- the exact markup of the switcher, including the truncation width;
- whether creating an organization navigates to the overview or stays on the form;
- what the UI renders if `GET /orgs.json` itself fails with a `500`;
- any loading skeleton or optimistic update behaviour.

Read `frontend/assets/js/utils/routing/`, `frontend/assets/js/utils/context/`,
`frontend/assets/js/components/common/ownerContext/` and the specs under `frontend/specs/` for the
authoritative version. Nothing on this page is inferred beyond what the docs state.
