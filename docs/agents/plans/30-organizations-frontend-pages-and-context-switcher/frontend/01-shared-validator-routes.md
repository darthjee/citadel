# Shared views, name validator and routes

Lay the ground the pages and the switcher depend on.

1. **`PermissionDenied.jsx`:** move it from
   `code_sample/frontend/assets/js/components/common/PermissionDenied.jsx` to
   `frontend/assets/js/components/common/PermissionDenied.jsx`, unchanged. It exports
   `PERMISSION_DENIED_MESSAGE` and the default view. Port ward's `PermissionDeniedSpec.js`.
2. **`NotFound.jsx`:** move it to `frontend/assets/js/components/common/notFound/NotFound.jsx`,
   unchanged. It exports `forgetStaleContext(userId, orgId, storage = ContextStorage)`, and the view
   calls it in an effect. Port ward's `NotFoundSpec.js`, which checks that:
   - the view renders a generic message and a "Go to Personal" link to `#/`;
   - the view never mentions the organization;
   - `forgetStaleContext` forgets a matching id;
   - it is a no-op without an org id;
   - it defaults to `ContextStorage`.
3. **`validateOrganizationName`:** copy `MAX_ORGANIZATION_NAME_LENGTH = 255` and
   `validateOrganizationName(name, field = 'name')` from ward's
   `assets/js/utils/validation/fieldValidators.js` into citadel's `fieldValidators.js`. The function
   trims the name, then returns:
   - `Name is required` when it is empty;
   - `Name must be at most 255 characters` when it is longer than 255 code points (`[...trimmed].length`);
   - `{}` otherwise.

   Add ward's cases to `fieldValidatorsSpec.js`:
   - blank or whitespace-only;
   - `null` or `undefined`;
   - exactly 255 code points accepted, 256 rejected;
   - an emoji counts once;
   - a custom field key.
4. **Routes:** in `frontend/assets/js/utils/routing/routes.js`:
   - add `['/orgs/new', 'org-new']` as the **first** row of `ROUTES_PERSONAL`, before `'/'`;
   - set `ROUTES_ORG_ONLY = [['/', 'org-overview'], ['/edit', 'org-edit']]`;
   - update the JSDoc to drop "the organization pages register their rows here" as future tense;
   - leave `ROUTES_CONTEXT` and `SECTIONS_CONTEXT` empty.

   Update `HashRouteResolverSpec.js`: its "ROUTES_ORG_ONLY is empty" assertion now expects the two
   rows. Add, or port from ward, cases resolving the real tables:
   - `#/orgs/new` → `org-new` in Personal, with no org id read;
   - `#/orgs/5` → `org-overview` in org 5;
   - `#/orgs/5/edit` → `org-edit` in org 5;
   - `#/orgs/abc/edit` → `not-found`.

## Files to Change

- `frontend/assets/js/components/common/PermissionDenied.jsx`: new (moved from the sample).
- `frontend/assets/js/components/common/notFound/NotFound.jsx`: new (moved from the sample).
- `frontend/assets/js/utils/validation/fieldValidators.js`: add `MAX_ORGANIZATION_NAME_LENGTH` and
  `validateOrganizationName`.
- `frontend/assets/js/utils/routing/routes.js`: add the organization rows.
- `frontend/specs/assets/js/components/common/PermissionDeniedSpec.js`: new (from ward).
- `frontend/specs/assets/js/components/common/notFound/NotFoundSpec.js`: new (from ward).
- `frontend/specs/assets/js/utils/validation/fieldValidatorsSpec.js`: add the validator cases.
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js`: expect the new tables and cover
  the organization routes.
- Delete `docs/agents/specs/orgs/code_sample/frontend/assets/js/components/common/PermissionDenied.jsx`
  and `.../common/notFound/NotFound.jsx`.
