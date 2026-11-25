# Controller, AuthModule and the port swap

- Move `auth/organization.controller.ts` unchanged (thin; `@Controller()` + `@CachePolicy(CacheClass.Never)`,
  GETs narrowed to `UserScoped`, writes `@InvalidatesPaths(...)`, `@StrictBody()` bodies, `parseOrgId()` on the
  raw `:orgId`). Routes: `GET /orgs.json`, `POST /orgs.json`, `GET /orgs/:orgId.json`, `PATCH /orgs/:orgId.json`.
- Reconcile `auth/auth.module.ts` with the sample: `Organization`/`OrganizationMembership` in
  `TypeOrmModule.forFeature`, `OrganizationController` in `controllers`, `OrganizationService` and
  `{ provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useExisting: OrganizationService }` in `providers`, both added to
  `exports`, plus the module doc comment paragraph. Keep everything else citadel already has.
- `app.module.ts`: remove the `ORGANIZATION_MEMBERSHIP_LOOKUP` / `NoOrganizationMembershipLookup` provider, its
  comment and imports. The global `OwnerContextGuard` (declared in `AppModule`) now resolves the token from the
  imported `AuthModule`'s exports. Guard order (Origin, Jwt, OwnerContext, Admin) is unchanged.
- Delete `core/no-organization-membership-lookup.ts` and `core/tests/no-organization-membership-lookup.spec.ts`.
- `core/tests/app.module.spec.ts`: drop the assertion that `AppModule` binds `NoOrganizationMembershipLookup`;
  assert instead (via `Reflect.getMetadata`) that `AppModule` no longer provides `ORGANIZATION_MEMBERSHIP_LOOKUP`
  and that `AuthModule` provides it with `useExisting: OrganizationService` and exports it.
- `core/tests/support/route-discovery.ts`: add `OrganizationController` to `KNOWN_CONTROLLERS`, so
  `cache-policy.coverage.spec.ts` and `cache-invalidation.coverage.spec.ts` cover it (it is not owner-scoped,
  so the owner-scoped coverage specs ignore it). Both writes declare `InvalidatesPaths`, both GETs `UserScoped`.

## Files to Change
- `backend/src/auth/organization.controller.ts` — new (ported)
- `backend/src/auth/auth.module.ts` — reconcile with the sample
- `backend/src/app.module.ts` — drop the fail-closed binding
- `backend/src/core/no-organization-membership-lookup.ts` — delete
- `backend/src/core/tests/no-organization-membership-lookup.spec.ts` — delete
- `backend/src/core/tests/app.module.spec.ts` — update the port assertion
- `backend/src/core/tests/support/route-discovery.ts` — add `OrganizationController`
