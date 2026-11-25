# App wiring: page keys and context remount

Port the relevant part of ward's `assets/js/components/helpers/AppHelper.jsx`.

1. **Register the page keys** in `AppHelper`'s `PAGES` map:
   - `['org-new', <OrganizationNew />]`, `['org-overview', <OrganizationOverview />]` and
     `['org-edit', <OrganizationEdit />]`;
   - `['not-found', <NotFound />]`, just before `home`.

   Unknown keys still fall back to home.
2. **Remount on context change:**
   - Add `contextKey(context)`, which returns `org-<id>` for an organization context and `personal`
     otherwise (including a missing context).
   - Change `AppHelper.render(page)` to `render(route)`, where `route` is `{ page, context }`.
   - Wrap the page in `<Fragment key={contextKey(route.context)}>` inside `<Header>`.
   - Update the JSDoc.

   Keep `OwnerContextProvider` where #29 mounted it, in `App.jsx`; do not move it into `AppHelper`.
   The effect matches ward's: the provider wraps the header and the page.
3. **`App.jsx`:** call `AppHelper.render(route)` instead of `AppHelper.render(route.page)`.
4. **Specs:**
   - `AppHelperSpec.js`:
     - switch every call to `render({ page, context: PERSONAL })`;
     - add cases for `org-new`, `org-overview`, `org-edit` and `not-found`;
     - check the keyed fragment: `personal` for Personal, `org-5` for org 5, and two different
       organizations producing different keys;
     - keep the unknown-key fallback.

     Port ward's `AppHelperSpec` cases where they fit, without the bank keys.
   - `AppSpec.js`: the `toHaveBeenCalledWith('home')` assertion becomes
     `toHaveBeenCalledWith({ page: 'home', context: PERSONAL })`, or a `jasmine.objectContaining`
     equivalent.

## Files to Change

- `frontend/assets/js/components/helpers/AppHelper.jsx`: add the organization and `not-found` keys,
  `contextKey`, the keyed `Fragment` and `render(route)`.
- `frontend/assets/js/App.jsx`: pass the route.
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js`: new route argument, new keys and the
  remount key.
- `frontend/specs/assets/js/AppSpec.js`: the `render` argument is now the route.
