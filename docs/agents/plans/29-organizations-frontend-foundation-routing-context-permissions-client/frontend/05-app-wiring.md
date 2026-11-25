# App wiring

The sample ships no `App`/`AppController` changes; adapt them to the new resolver and mount the
provider, with no visible change.

- `AppController`: `getPage()` becomes `getRoute()` (or `resolve()`), returning
  `this.routeResolver.resolve()` (`{ page, context }`); the constructor takes `setRoute`, and the
  `hashchange` effect calls `setRoute(this.getRoute())`.
- `App.jsx`: state holds the route (initial `{ page: 'home', context: PERSONAL }`); render
  `<OwnerContextProvider route={route}>{AppHelper.render(route.page)}</OwnerContextProvider>`.
  Memoise nothing new beyond what the provider needs: `route` changes only on hash change.
- `AppHelper.render(page)` unchanged: unknown keys (including `not-found`) fall back to `home`
  until #30 adds `NotFound`.
- Update `AppControllerSpec.js` (resolve result, hashchange updates the route) and `AppSpec.js`.
  Check any other `getPage()` caller (`grep -rn getPage frontend/`).

## Files to Change

- `frontend/assets/js/components/AppController.js` — route instead of page.
- `frontend/assets/js/App.jsx` — route state, mount `OwnerContextProvider`.
- `frontend/specs/assets/js/components/AppControllerSpec.js` — update.
- `frontend/specs/assets/js/AppSpec.js` — update.
