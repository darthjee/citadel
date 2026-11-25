# Port the guard and wire it globally

1. Move `owner-context.guard.ts` to `backend/src/core/`, unchanged. It reuses citadel's existing
   `boolean-metadata.ts` (`readBooleanMetadata`), and the order in `canActivate` is the contract: metadata check,
   then resolve (missing user -> 404, no `:orgId` -> personal, `parseOrgId` -> 404, `findRole` `null` -> 404),
   then store `request.ownerContext`, then `@MinOrgRole` -> 403.
2. Move `owner-context.guard.spec.ts` to `backend/src/core/tests/`, fixing imports only. Keep every security case
   intact: a non-member gets 404 and never 403, a global admin non-member gets 404, the role is looked up on every
   call (no caching), a malformed `:orgId` never reaches the lookup, and the personal context counts as `owner`.
3. Register in `backend/src/app.module.ts`:
   - `{ provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useClass: NoOrganizationMembershipLookup }`, with a comment that
     #28 replaces it with `OrganizationService`, bound in `AuthModule`;
   - `{ provide: APP_GUARD, useClass: OwnerContextGuard }` **directly after** the `JwtGuard` entry (it needs
     `request.user`). Nest runs `APP_GUARD`s in registration order;
   - `{ provide: APP_INTERCEPTOR, useClass: CacheInvalidationInterceptor }` after `CachePolicyInterceptor`.
   Update the `AppModule` doc comment's description of the global chain.
4. Extend `backend/src/core/tests/app.module.spec.ts` (it already imports `app.module.js` without booting it).
   Read `Reflect.getMetadata('providers', AppModule)` and assert:
   - the `APP_GUARD` entries are `OriginGuard`, `JwtGuard`, `OwnerContextGuard`, `AdminGuard`, in that order,
     so `OwnerContextGuard` comes after `JwtGuard`;
   - `CacheInvalidationInterceptor` is an `APP_INTERCEPTOR`;
   - `ORGANIZATION_MEMBERSHIP_LOOKUP` is bound to `NoOrganizationMembershipLookup`.
5. Move `owner-scoped.module.e2e-spec.ts` to `backend/src/core/tests/` and adapt it:
   - keep the fake lookup, the stub user guard, and the lazily loaded `LedgerModule` through citadel's
     `LazyModuleLoaderService`;
   - wire `HttpExceptionFilter` the way citadel's `request-logging.e2e-spec.ts` does (`APP_FILTER` + `LoggingModule`);
   - register `CacheInvalidationInterceptor` too, and add one write route proving that a successful write
     carries `X-Cache-Invalidate: /ledger` (personal) or `/orgs/3/ledger` (organization), and that a 404 or 403
     carries none;
   - replace the `x-cache-allow` expectations with citadel's model: `x-skip-cache` is present on the user-scoped
     response.
   Keep its 404 cases (non-member, malformed id, missing user) and the uniform body assertions.

## Files to Change

- `backend/src/core/owner-context.guard.ts`: new (moved).
- `backend/src/core/tests/owner-context.guard.spec.ts`: new (moved).
- `backend/src/app.module.ts`: bind the default lookup, register the guard and the interceptor.
- `backend/src/core/tests/app.module.spec.ts`: provider-order assertions.
- `backend/src/core/tests/owner-scoped.module.e2e-spec.ts`: new (moved, adapted).
