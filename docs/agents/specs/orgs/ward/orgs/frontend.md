# Organizations - Frontend

Part of the [Auth module](../auth.md). Hub: [Organizations](./orgs.md).
See also: [Endpoints](./endpoints.md), [Roles](./roles.md), [Caching](./caching.md),
[Response](./response.md).

## Summary

The frontend side of organizations (#47, with roles from #144) is **cross-cutting**: it is not a
page set that owns the context concept, it is the mechanism every user-or-organization-owned
module registers into once and then works in both contexts for free.

- **Two URL prefixes**: Personal `#/<module>/...`, organization `#/orgs/:orgId/<module>/...`.
- **The router** resolves which context from the hash, and a malformed id resolves to not-found
  **without issuing a request**.
- **The context is passed as an argument** to API clients, never read from global state.
- **The last used context** is remembered per user in local storage and applied only at the entry
  point.
- **The backend is the authority**; the frontend only hides what the role cannot do. `can()`
  **fails closed**.
- **A `403` refreshes the role**, so a role changed mid-session is picked up on the next failure.

## Stack and layout

- React 19 + Bootstrap / react-bootstrap, Vite, Jasmine + c8.
- ESLint: 2-space indent, single quotes, semicolons required, **max complexity 10**,
  **max 300 lines per file**, JSDoc required on public API.
- Every backend domain module gets a matching `client/<Name>Client.js` and its pages under
  `components/resources/<area>/pages/`.

### Files involved

| File | Role |
|---|---|
| `utils/routing/routes.js` | The three route tables plus `SECTIONS_CONTEXT` |
| `utils/routing/HashRouteResolver.js` | Resolves `{ page, context }` from the hash |
| `utils/routing/Router.js` | `Router.extractContextParams(pattern, hash)` |
| `utils/routing/sectionTarget.js` | `switchTargetFor(hash)` - where a context switch lands |
| `utils/routing/hashQuery.js` | `hashQuery` / `withHashQuery` for the `?...` part of the hash |
| `utils/context/ownerContext.js` | `contextPath()`, `contextHash()`, `landingFor()` |
| `utils/context/ContextStorage.js` | The remembered context, per user |
| `utils/context/entryResolution.js` | Applies the remembered context at the entry point |
| `utils/permissions/orgPermissions.js` | `ROLES`, `ACTIONS`, `can(role, action)` |
| `components/common/ownerContext/OwnerContextProvider.jsx` | Provides `role`, `refreshRole`, `buildOwnerContextValue` |
| `components/common/ownerContext/hooks/useOwnerContext.js` | Reads the context |
| `components/common/ownerContext/hooks/useCan.js` | `useCan(action)` for the active context |
| `components/common/ownerContext/controllers/OrgListController.js` | Org list per session |
| `components/common/ownerContext/controllers/forbiddenRefreshEffect.js` | Refreshes the role on a `403` |
| `components/common/header/contextSwitcher/` | The switcher UI |
| `components/resources/organizations/pages/` | `OrganizationNew`, `OrganizationOverview`, `OrganizationEdit` |
| `client/PermissionEvents.js` | The `permission:forbidden` window event |
| `client/ApiClient.js` / `client/ApiError.js` | The HTTP layer and its error type |

## URL and routing

### The two prefixes

| Context | UI path |
|---|---|
| Personal | `#/<module>/...` |
| an organization | `#/orgs/:orgId/<module>/...` |

### Three route tables

`routes.js` holds three tables. The split is the mechanism, not a convention.

| Table | Contents |
|---|---|
| `ROUTES_PERSONAL` | Personal-only routes - includes `/orgs/new` |
| `ROUTES_ORG_ONLY` | `#/` overview, `#/edit` rename |
| `ROUTES_CONTEXT` | Context-aware routes. **Modules add their own paths here, never mentioning `orgs`** |

The third table is the whole trick: a module registers `/bank/accounts` **once** and it works in
both contexts, because the resolver decides the context before matching.

### Resolution order

`HashRouteResolver.resolve()` runs in this order:

1. Match **`ROUTES_PERSONAL`** first.
2. Strip an **`/orgs/<seg>`** prefix.
   - A malformed `<seg>` - outside `^[1-9][0-9]*$`, or above **2147483647** - resolves to
     **`not-found` with no request issued**.
3. Match the remainder against **`ROUTES_ORG_ONLY`** and **`ROUTES_CONTEXT`**.
4. Otherwise, context-aware routes match as **Personal**.
5. Unknown paths fall back to `home`.

It returns **`{ page, context }`**, where `context` is:

```
{ kind: 'personal' }
{ kind: 'organization', orgId }
```

Pages read their params with `Router.extractContextParams(pattern, hash)`, against the
**stripped** path - not the raw hash.

### Malformed ids never reach the network

The `2147483647` bound and the `^[1-9][0-9]*$` pattern are a **client-side mirror** of the
backend's `parseOrgId()` strictness. A bad id in the URL produces the `not-found` view with **no
API call at all**, which is why a typo in the address bar does not generate a `404` round trip.

## Context helpers

Three helpers in `utils/context/ownerContext.js`, so no page builds a path by hand:

| Helper | Purpose |
|---|---|
| `contextPath(context, '/x.json')` | Builds the **API** path for the context |
| `contextHash(context, '/x')` | Builds a **hash link** for the context |
| `landingFor(context)` | The switch target: `#/` for Personal, `#/orgs/:orgId` for an organization |

Two rules that follow:

- **API clients take the context as an argument**, never from global state. A client that reads a
  module-level "current organization" would make the context ambient and reintroduce the leak the
  backend guard prevents.
- **The query string is dropped** on a context switch.

## The provider

- `AppHelper` wraps the header **and** the page in `OwnerContextProvider`.
- Read the context with `useOwnerContext()`.
- **`GET /orgs.json` is loaded once per session** - after login or on page load.
- It is **refetched after a create or a rename**, and **cleared on logout**.
- **Pages are keyed by context**, so moving between organizations **remounts** them.

The last point matters: remounting is what guarantees no state from organization A is displayed
while organization B's data loads.

## Last used context

`ContextStorage.js` plus `entryResolution.js`.

| Property | Value |
|---|---|
| Storage key | **`ward.context.<userId>`** |
| Stored value | The **organization id only** - nothing else |
| Access | Every access in `try` / `catch`; unavailable storage **means Personal** |
| Applied when | **Only at the entry point** (`''` or `#/`), **after** the org list loads |
| Applied if | The id **is in the list** - otherwise it is **forgotten** |
| Updated by | Context-aware page visits and switcher picks. **Context-neutral pages do not** update it |
| On logout | **Not cleared** |

Three consequences worth noting:

1. **It is not applied on a deep link.** Only `''` or `#/` uses the remembered context; a link to
   `#/orgs/7/bank/accounts` goes to organization 7 regardless.
2. **A stale id is dropped, not trusted.** Since the id is validated against the loaded list, a
   membership removed in the meantime falls back to Personal. The backend would answer `404`
   anyway - the frontend just does not create the situation.
3. **Logout does not clear it**, so logging back in returns you to the last organization, provided
   you still belong to it.

## The switcher

`components/common/header/contextSwitcher/`, placed **left of the header after the brand**.

It lists:

1. **Personal**
2. **Each of the user's organizations** - the active one is checked; names are **truncated with
   the full name in the `title` attribute**
3. **+ Create organization**

Behavior:

- **Hidden while logged out or pending** - a `pending` user has no usable session.
- **Shows an inline error when `/orgs.json` fails** - the switcher degrades, it does not disappear
  silently.
- **With zero organizations it shows only Personal and Create organization.** This is the normal
  state for a new user.
- **Picking Personal stores it before navigating**, so the choice survives the next entry.

## Section registry - where a switch lands

`SECTIONS_CONTEXT` in `routes.js`, resolved by `switchTargetFor(hash)` in
`utils/routing/sectionTarget.js`.

- It maps **context-relative path prefixes** to that section's **list path**.
- A switch made from a page whose stripped path matches a prefix **on a segment boundary** lands
  on that **section's list in the new context**.
- Anything else lands on `landingFor(context)`.
- The **query string is dropped**, and each switcher item's `href` uses the same target - so a
  middle-click and a normal click go to the same place.

The point: switching context from a list page keeps you in that list; switching from a detail page
does not try to carry the record id across organizations, because that id belongs to the other
owner.

Modules register their own rows. `bank`, as the documented example, registers `/bank/accounts`,
`/bank/debts`, `/bank/investments`, `/bank/providers` (whose prefix also covers the accountant
hand-off page) and `/bank/calendar` (which also covers the month view), and maps `/bank/bills` to
the Providers list because the one-off bill pages have no list of their own.

## Hash query

`utils/routing/hashQuery.js` provides `hashQuery` and `withHashQuery` to read and write the
`?...` part of the hash - for example the ledger's `?page=` and the list's `?archived=true`.

It exists because the context lives in the hash too, so query params need their own small parser
rather than the browser's `location.search`.

## Pages

| Route | Page | Contents |
|---|---|---|
| `#/orgs/new` | `OrganizationNew` | The create form. In `ROUTES_PERSONAL`, since creating is not itself an organization context |
| `#/orgs/:orgId` | `OrganizationOverview` | **Name, role, and a Rename link** |
| `#/orgs/:orgId/edit` | `OrganizationEdit` | The rename form |

- `#/` and `#/edit` are in **`ROUTES_ORG_ONLY`** - they exist only under an organization prefix.
- **A backend `404` or a malformed id renders the generic `NotFound` view**, which **forgets that
  id if it was remembered** and offers "Go to Personal".
- **Names are always rendered as React text**, never as HTML - the same rule as the backend's
  escaping requirement.

Note the divider the overview documents: the page shows **the caller's role**. There is no owner
field, no member list, no member count - because the API never returns them. See
[Response](./response.md).

## Permissions

The backend is the authority. The frontend **only hides what the role cannot do**, and it
**fails closed**.

### Role on the owner context

`buildOwnerContextValue` (`OwnerContextProvider.jsx`) adds two things to the context value:

| Field | Value |
|---|---|
| `role` | **`owner` in Personal**; the active organization's `role` from `GET /orgs.json` in an organization; **`null` while loading or when the organization is not listed** |
| `refreshRole` | The **org-list refetch** - `refreshOrgs` |

- **There is no separate role request.** The role rides along with the org list, which is why the
  list is loaded once per session.
- `DEFAULT_OWNER_CONTEXT` has **`role: null`**, so a component rendered before the list loads sees
  no role rather than a guessed one.

### `can(role, action)`

`utils/permissions/orgPermissions.js` exports `ROLES`, `ACTIONS` and `can(role, action)`. It
**mirrors the backend matrix**, ranked `user` < `admin` < `owner`.

| Action (`ACTIONS`) | Minimum role |
|---|---|
| `WRITE` | `user` |
| `UNDO_PAYMENT` | `admin` |
| `EDIT_PAYMENT_TRANSACTION` | `admin` |
| `MANAGE_ACCOUNTS` | `admin` |
| `RENAME_ORGANIZATION` | `admin` |
| `DELETE` | `admin` |

**It fails closed**: an unknown or `null` role, or an unknown action, answers **`false`**.

That is the exact counterpart of the backend rule that the personal context counts as `owner`
(`role: 'owner'` in Personal) - so `can()` needs no personal-specific branch.

### `useCan(action)`

`useCan(action)` (`ownerContext/hooks/useCan.js`) returns `can(role, action)` for the **active
context**.

`useManageAccountsGate()` (`bank/common/form/hooks/`) returns `{ forbidden, allowed }` for the
account forms, and sets `forbidden` **only once the role is known** - so the form does not flash a
forbidden state while the list is still loading.

### Role refresh on 403

This is the piece that makes a mid-session role change take effect without a reload.

| Piece | Detail |
|---|---|
| Event | Window event **`permission:forbidden`** |
| Module | `client/PermissionEvents.js`: `emitForbidden()`, `onForbidden(listener)` returning an unsubscribe |
| Emitted by | **`ApiClient`, on any `403`, before throwing the `ApiError`** |
| Consumed by | The provider mounts **`forbiddenRefreshEffect`** with `refreshOrgs` |
| Burst control | An **in-flight flag collapses a burst of 403s into one refresh** |

Consequence: a role changed in the database applies on the **next request** server-side (the role
is re-read from the DB per request - see [Roles](./roles.md)), and the **UI catches up on the next
`403`**, not on the next page load.

### Hidden controls for `user`

`admin` and `owner` see everything. For a `user`, the frontend hides:

- the account list's **New** button and its empty-list call to action;
- on an account: **Edit / Rename**, **Archive / Unarchive**;
- and further bank controls documented in the bank UI page;
- the Edit page **skips its load**, and `#/orgs/:orgId/edit` is not reachable;
- the whole gate **renders nothing while `role` is `null`**.

None of this is a security boundary - every one of those actions is refused by the backend. Hiding
is a UX affordance; the enforcement is in the service and in `@MinOrgRole`.

## API errors

Any non-`401` failure from `client/ApiClient.js` rejects with a `client/ApiError.js`, built from
the backend's standard body `{ error: { code, message, details? }, statusCode, timestamp }`.

- `error.details` carries the full list of validation messages, present **only** on validation
  failures and `undefined` otherwise.
- A **`403`** also fires `PermissionEvents.emitForbidden()`, which refreshes the role.
- In the bank pages, `classifyError` (`bank/common/bankErrors.js`) maps a `403` to the
  **`forbidden`** kind, with `PERMISSION_DENIED_MESSAGE` ("You don't have permission to do this",
  exported by `PermissionDenied.jsx`), rendered by `BankErrorAlert` as a plain danger alert with
  **no Retry** - Retry is only for the `transient` kind.
- **The organization rename form shows the same message on a `403`.**

A `401` is different: `ApiClient` handles it in its own session-expired path, which is why the
`403` branch is the only one that refreshes the role.

## What the frontend does not do

- **It does not decide authorization.** Every hidden control corresponds to a backend refusal.
- **It does not send a role.** `role` is never part of a request body - and the backend rejects
  unknown body fields anyway.
- **It does not send an owner.** `organizationId` comes from the URL, and the client builds the
  path with `contextPath()`.
- **It does not list members.** No such endpoint exists, and no page tries.
- **It does not cache the role separately** from the org list - which is why a refresh is a list
  refetch.
- **It does not clear the remembered context on logout**, by design.

## What is not documented in the repository

The `docs/agents/` pages describe the routing tables, the resolver order, the helpers, the storage
key, the switcher, the section registry, the pages, the permission map and the `403` refresh in
detail. They do **not** contain:

- the source of `HashRouteResolver`, `Route`, `entryResolution` or `OrgListController`;
- the full route table contents beyond the three org routes and the bank rows given as examples;
- how `OwnerContextProvider` keys pages by context (a React `key` prop, a wrapper component, or
  equivalent);
- the exact `href` markup of a switcher item beyond "uses the same target";
- how name truncation is implemented (CSS versus JavaScript);
- whether the switcher has an accessible label or keyboard navigation contract;
- the Jasmine specs covering these pieces, beyond their presence under `frontend/specs/`;
- whether `can()` mirrors the backend matrix exhaustively - the table above is the documented set,
  and the docs do not claim it is complete for every module.

Read `frontend/assets/js/utils/` and `frontend/assets/js/components/` for the authoritative
version. Nothing on this page is inferred beyond what the docs state.
