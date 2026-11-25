# Issue: Organizations: frontend pages and context switcher

## Description

Part of epic #25 (Organizations: optional org ownership for domain data). Citadel is a project
template. Organizations ship with it so that derived projects can have domain data owned by an
organization instead of by a single user. The target behaviour is specified in
`docs/agents/specs/orgs/` (hub: `README.md`), and the original implementation is mirrored under
`docs/agents/specs/orgs/code_sample/`, at the same paths as in the real codebase.

**Approach (applies to every sub-issue):** move the files from `code_sample/` into their real
location, then adapt them to citadel. Stay close to the original so fixes can flow between citadel
and its derived projects. Where a file already exists in citadel, reconcile the two by merging the
organization-related changes rather than overwriting. Remove each `code_sample/` file once it has been
moved or reconciled, and fold what matters from the spec pages into the permanent docs
(for example `docs/agents/modules/auth/organizations.md` and `docs/agents/modules/auth.md`).
Cache, data-access and security reviews are decided during this issue's planning.

This issue builds the **visible organizations UI** on top of the foundation from #29 (merged):

- the three organization pages;
- the header context switcher, with its **+ Create organization** entry;
- the shared Not-found and permission-denied views;
- the organization routes;
- role-gated controls.

When it ships, the frontend part of the sample (`code_sample/frontend/`) is fully ported and removed.

The original project, ward, is available locally at `~/projetos/mine/ward`. Where the sample leaves
something out, ward's own source and specs are the reference to port from.

Spec references: `frontend.md`, `edge-cases.md`, `examples.md`, and sections 6–9 of
`code-sample-frontend.md`.

## Problem

- #29 wired the routing, the owner context, permissions and the client, but nothing uses them yet:
  - the route tables carry no organization route;
  - `HashRouteResolver`'s `not-found` key falls back to the home page;
  - there is no way to create, view, rename or switch to an organization.
- The sample omits pieces that the ported files depend on:
  - `validateOrganizationName()`, which the forms import from `utils/validation/fieldValidators.js`.
    Citadel's copy of that file does not have it.
  - ward's `HeaderHelper.jsx`, which is where the switcher is mounted. The sample's `Header.jsx` is
    identical to citadel's.
  - ward's `AppHelper` page registrations, and the context-keyed remount.
- The sample ships specs for only 5 of this issue's files (the page controllers and helpers). The
  switcher, `NotFound`, `PermissionDenied`, the validator, and the `AppHelper` and `HeaderHelper`
  changes have none in the sample. Ward does have specs for them.

## Expected Behavior

- **Routes** (in `utils/routing/routes.js`):
  - `['/orgs/new', 'org-new']` at the top of `ROUTES_PERSONAL`, before `'/'`, so that `/orgs/new` is
    never read as an organization id;
  - `['/', 'org-overview']` and `['/edit', 'org-edit']` in `ROUTES_ORG_ONLY`.
  - `ROUTES_CONTEXT` and `SECTIONS_CONTEXT` stay empty; #31 fills them.
- **Pages:**
  - `#/orgs/new` → `OrganizationNew`: a name form. Creating refreshes the org list, then navigates to
    the new organization's overview.
  - `#/orgs/:orgId` → `OrganizationOverview`: fetched on every visit. It shows the name, the user's
    role, and a **Rename** link only when `useCan(ACTIONS.RENAME_ORGANIZATION)` is true (`admin` or
    `owner`).
  - `#/orgs/:orgId/edit` → `OrganizationEdit`:
    - The form is prefilled from a fetch.
    - Saving refreshes the org list and goes back to the overview.
    - Nothing renders while the role is still unknown (`null`).
    - A role that may not rename sees `PermissionDenied`.
    - A `403` on save shows `PERMISSION_DENIED_MESSAGE` inline.
  - A `404` on load or save shows `NotFound`.
  - On both forms, a session-expired rejection only resets `pending`: no error is shown and there is
    no navigation.
- **Client-side name check**, taken from ward: `validateOrganizationName(name, field = 'name')` and
  `MAX_ORGANIZATION_NAME_LENGTH = 255` in `fieldValidators.js`.
  - It returns `Name is required` when the trimmed name is empty.
  - It returns `Name must be at most 255 characters` when the trimmed name is longer than 255
    **code points**, so an emoji counts once.
  - Control characters and anything else are left to the backend `400`, which decides
    authoritatively.
- **Context switcher:**
  - It is a `NavDropdown` with `id="context-switcher"`, rendered by `HeaderHelper` itself (as in ward),
    first in the left `Nav` after the brand and before the auth links.
  - It is hidden while the user is logged out or pending approval.
  - Entries, in order:
    1. **Personal**, always first;
    2. the caller's organizations from `useOwnerContext().orgs`;
    3. **+ Create organization** (`#/orgs/new`), whatever the number of organizations.
  - The active entry is checked.
  - Long names are truncated, with the full text in `title`. The title shows the organization's name
    from the list, or the neutral `Organization` when it is not listed (never a name read from
    storage).
  - When `/orgs.json` fails, it shows the inline `Could not load organizations`. The rest of the app
    keeps working.
  - Picking an entry remembers it in `ContextStorage` **before** navigating, to
    `switchTargetFor(currentHash)`: the equivalent section if one is registered, otherwise the
    context's landing page. An item's `href` uses the same target as its click.
- **Not found and permission denied:**
  - The `not-found` page key renders `NotFound`. It is the same view for a malformed id and for a
    backend `404`, so it never reveals whether an organization exists. It offers **Go to Personal**
    and calls `forgetStaleContext(userId, orgId)`, which forgets the id when it is the remembered
    context.
  - `PermissionDenied` exports `PERMISSION_DENIED_MESSAGE` ("You don't have permission to do this").
- **Remount on context change:**
  - `AppHelper.render(route)` takes the whole route and wraps the page in
    `<Fragment key={contextKey(route.context)}>`, where the key is `personal` or `org-<id>`.
  - Switching from org 1 to org 2 therefore remounts the page with fresh state: no stale org name and
    no stuck Not-found.
  - `App.jsx` passes the route instead of `route.page`. Unknown page keys still fall back to home.
- **No regression:** the existing personal pages, the header links and the login flow behave as
  before.

## Solution

### Port from `code_sample/frontend/assets/js/components/`

Moved into `frontend/assets/js/components/`, staying close to the original. Comments that mention
ward or the bank module are made generic.

- `resources/organizations/pages/`:
  - pages: `OrganizationNew.jsx`, `OrganizationOverview.jsx`, `OrganizationEdit.jsx`;
  - `controllers/`: `OrganizationNewController.js`, `OrganizationEditController.js`,
    `OrganizationFormController.js`, `OrganizationLoader.js`, `navigation.js`;
  - `helpers/`: `OrganizationFormHelper.jsx`, `OrganizationOverviewHelper.jsx`.
- `common/header/contextSwitcher/`: `ContextSwitcher.jsx`,
  `controllers/ContextSwitcherController.js`, `helpers/ContextSwitcherHelper.jsx`.
- `common/notFound/NotFound.jsx` and `common/PermissionDenied.jsx`.
- `common/header/Header.jsx` is identical to citadel's, so there is nothing to reconcile. Delete the
  sample copy.
- The 5 sample specs, adapted: `OrganizationNewControllerSpec`, `OrganizationEditControllerSpec`,
  `OrganizationLoaderSpec`, `OrganizationFormHelperSpec`, `OrganizationOverviewHelperSpec`.

### Port from ward (absent from the sample)

- `validateOrganizationName` and `MAX_ORGANIZATION_NAME_LENGTH`, added to
  `utils/validation/fieldValidators.js`, with their cases in `fieldValidatorsSpec.js`.
- `HeaderHelper.jsx`: import `ContextSwitcher` and render
  `<ContextSwitcher loggedIn={isLoggedIn} pending={pending} />` first in the left `Nav`.
  - Ward's `BankMenu` is not ported.
  - Ward's right-aligned account `Nav` split is not ported. Citadel keeps its current link layout.
- `AppHelper.jsx`:
  - register `org-new`, `org-overview`, `org-edit` and `not-found`;
  - add `contextKey(context)` and the keyed `Fragment`;
  - `render(route)` instead of `render(page)`, with `App.jsx` updated to match.
- Specs from ward, adapted to citadel (no bank or `ms-auto` assertions):
  - `ContextSwitcherSpec`, `ContextSwitcherControllerSpec`, `ContextSwitcherHelperSpec`;
  - `NotFoundSpec`, `PermissionDeniedSpec`;
  - `OrganizationPagesSpec`, which covers page wiring and role gating;
  - the support file `specs/support/roleGatedPageExamples.js`, which citadel does not have yet;
  - the switcher cases in `HeaderHelperSpec`, plus the new page keys and the context remount in
    `AppHelperSpec`, `AppSpec` and `routes`/`HashRouteResolver` specs where they cover the tables.
- Where ward has no spec for a ported or changed file, write a new one, so every file this issue adds
  or changes is covered.

### Cleanup and docs

- Delete every `code_sample/frontend/` file this issue ports. After this issue, `code_sample/frontend/`
  is empty and is removed.
- Update `code-sample-frontend.md` (sections 6–9 and the checklist) and `code-sample.md` to mark the
  frontend as fully ported.
- Fold the following into the permanent docs (the Frontend section of
  `docs/agents/modules/auth/organizations.md`, and `docs/agents/architecture/frontend.md`):
  - the organization pages and routes;
  - the switcher's behaviour;
  - the Not-found and permission-denied rules;
  - the after-write `refreshOrgs()` rule;
  - the context-keyed remount.

### Out of scope

- The example owner-scoped module and its `ROUTES_CONTEXT` and `SECTIONS_CONTEXT` rows (#31).
- Proxy and per-user caching (#33).
- Member and role management.
- Deleting an organization from the UI.
- Any backend change: `/orgs` already serves everything these pages need.

### Testing

The frontend suite and lint pass through `docker-compose`:

- `docker-compose run --rm citadel_placeholder_fe yarn test`
- `docker-compose run --rm citadel_placeholder_fe yarn lint`

The CI jobs `jasmine` (coverage) and `frontend-checks` pass. The existing specs pass unchanged, except
`AppHelper`, `App` and `HeaderHelper`, whose specs are extended for the new route argument and the
switcher.

## Benefits

- Users can create, view, rename and switch between organizations. This is the first visible payoff
  of epic #25.
- Controls hide or disable exactly where the backend would refuse. A role drop is picked up on the
  next `403`, through the foundation from #29.
- A single Not-found view for malformed and unknown ids never reveals whether an organization exists,
  and it cleans up a stale remembered context.
- The context-keyed remount keeps every current and future context-aware page free of state leaking
  between organizations.
- Porting from ward, including the pieces the sample left out, keeps fixes portable between citadel
  and its derived projects, and finishes the frontend part of the sample.
