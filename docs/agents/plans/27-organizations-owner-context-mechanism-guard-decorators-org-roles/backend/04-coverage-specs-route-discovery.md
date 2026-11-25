# Coverage specs and shared route discovery

1. Move `tests/support/route-discovery.ts` to `backend/src/core/tests/support/route-discovery.ts`.
   - `SRC_ROOT` stays `resolve(__dirname, '..', '..', '..')` (-> `backend/src`).
   - `KNOWN_CONTROLLERS` becomes citadel's list: `AdminController`, `AuthController`,
     `AuthorizationRequestController`, `HealthController`.
   - Keep `RouteEntry`, `routesOf()`, `discoverControllers()` and `READ_METHODS` unchanged.
   - Check that Jest's `testMatch` does not pick the file up as a spec. It is named `*.ts`, not `*.spec.ts`, so
     it should not be; confirm in `jest.config.mjs`.
2. Refactor `backend/src/core/tests/cache-policy.coverage.spec.ts` to import `discoverControllers`, `routesOf`,
   `KNOWN_CONTROLLERS` and `RouteEntry` from the support file, deleting its local copy. Its assertions and failure
   messages stay the same.
3. Move `min-org-role.coverage.spec.ts` to `backend/src/core/tests/`. Remove the
   "discovers owner-scoped write routes (so a broken glob cannot pass vacuously)" test, with a comment:
   restored by #31 once a real owner-scoped controller exists. Keep the `KNOWN_CONTROLLERS` check in
   `beforeAll`, which still guards against a broken glob, and keep the fixture tests.
4. New `backend/src/core/tests/owner-scoped.coverage.spec.ts`:
   - every owner-scoped route avoids a plain `@Body()` (`usesPlainBody === false`). The failure message tells
     the author to use `@StrictBody()`;
   - no owner-scoped route has cache class `CacheClass.Public`;
   - fixture controllers (never registered) prove both checks flag a violation: an `@OwnerScopedController()`
     with a `@Body()` handler, and one with a handler overriding `@CachePolicy(CacheClass.Public)`. A
     `@StrictBody()` handler and a `CacheClass.Never` override must not be flagged.
5. New `backend/src/core/tests/cache-invalidation.coverage.spec.ts`:
   - every owner-scoped write (non-GET/HEAD) has an `invalidation` declaration (owner, paths or none);
   - fixture tests prove it: an `@OwnerScoped()`-only controller (no `@OwnerScopedController()`) with an
     undeclared `POST` is flagged, while `@OwnerScopedController()` writes (class-level `InvalidatesOwner()`) and
     a handler with `NoCacheInvalidation()` are not.
   Both new specs drop the "> 0 routes" assertion for the same reason as step 3.

## Files to Change

- `backend/src/core/tests/support/route-discovery.ts`: new (moved, adapted).
- `backend/src/core/tests/cache-policy.coverage.spec.ts`: use the shared support file.
- `backend/src/core/tests/min-org-role.coverage.spec.ts`: new (moved, adapted).
- `backend/src/core/tests/owner-scoped.coverage.spec.ts`: new.
- `backend/src/core/tests/cache-invalidation.coverage.spec.ts`: new.
