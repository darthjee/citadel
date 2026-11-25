# Routing

Port the context-aware routing from the sample.

- Add `utils/routing/routes.js` exporting `ROUTES_PERSONAL`, `ROUTES_ORG_ONLY`, `ROUTES_CONTEXT`
  and `SECTIONS_CONTEXT`, keeping the sample's JSDoc explaining ordering, made generic (no bank).
  - `ROUTES_PERSONAL`: citadel's current `ROUTES` table from `HashRouteResolver.js`
    (`/recover-password`, `/admin/users/:id/edit`, `/admin/users`, `/account/authorization-requests`,
    `/account/my-account`, `/` last). **No** `/orgs/new` row (#30 adds it, above `'/'`).
  - `ROUTES_ORG_ONLY`, `ROUTES_CONTEXT`, `SECTIONS_CONTEXT`: empty arrays, with comments saying
    modules register rows there (#31 adds the example module) and #30 adds `org-overview`/`org-edit`.
- Reconcile `HashRouteResolver.js` with the sample: `resolve()` returning `{ page, context }`
  replaces `getPage()`, the constructor takes `{ contextRoutes }` (used by specs), lookup order
  personal → `/orgs/<id>` prefix (malformed id → `{ page: 'not-found', context: PERSONAL }`, no
  request) → context routes as personal → `home`. It imports `ownerContext.js` (step 02); land both
  steps before running the suite.
- Reconcile `Router.js`: add `extractContextParams(path, hash)` (strips the `/orgs/<id>` prefix).
- Add `hashQuery.js` and `sectionTarget.js` as-is (generic comments).
- Specs: reconcile `HashRouteResolverSpec.js` and `RouterSpec.js` with the sample versions; add
  `hashQuerySpec.js` and `sectionTargetSpec.js`. Where a sample spec relies on bank rows of the real
  tables, pass fixture routes through `contextRoutes` instead. `sectionListPathFor` /
  `switchTargetFor` take an optional `sections` argument: drop the sample's "registers the bank ...
  section" assertions (replace them with one asserting `SECTIONS_CONTEXT` is an array) and run the
  behaviour cases against fixture sections.
  Keep coverage of the malformed-id guard: `0`, leading zero, non-digits, `2147483648` → `not-found`.

## Files to Change

- `frontend/assets/js/utils/routing/routes.js` — new, citadel tables.
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — reconcile (`resolve()`).
- `frontend/assets/js/utils/routing/Router.js` — reconcile (`extractContextParams`).
- `frontend/assets/js/utils/routing/hashQuery.js` — new.
- `frontend/assets/js/utils/routing/sectionTarget.js` — new.
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` — reconcile.
- `frontend/specs/assets/js/utils/routing/RouterSpec.js` — reconcile.
- `frontend/specs/assets/js/utils/routing/hashQuerySpec.js` — new.
- `frontend/specs/assets/js/utils/routing/sectionTargetSpec.js` — new.
