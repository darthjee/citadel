# Test support and e2e specs

Reconcile the shared auth test support, then port the e2e specs.

- `auth/tests/support/in-memory-organization-repos.ts`: new (ported) — in-memory organization and membership
  repos sharing a fake transaction manager.
- `auth/tests/support/in-memory-repo.ts`: take the sample's `In()` operator support and the typed
  `FakeUpdateQueryBuilder`; keep the rest of citadel's file.
- `auth/tests/support/build-auth-test-app.ts`: take the sample's organization repos (`organizationRepo`,
  `membershipRepo` on the returned harness), the `ownerContextGuard?: boolean` option (registers
  `OwnerContextGuard` as an `APP_GUARD`, last, backed by the real `OrganizationService`), and the
  `CacheInvalidationInterceptor` `APP_INTERCEPTOR`. Comments keep citadel's model: `X-Skip-Cache` /
  `Cache-Control` only, never `X-Cache-Allow`. Existing auth e2e specs must keep passing unchanged.
- `auth-requests.ts`, `error-body.ts`, `in-memory-session-lookup.ts` are identical in citadel: keep citadel's.
- Port `organization.controller.e2e-test-support.ts` and the four e2e specs
  (`organization.controller.create|read|rename|not-found.e2e-spec.ts`): list/show/create/rename, the uniform 404
  (unknown, malformed, foreign, non-member global admin), 400 for unknown body fields (`role`,
  `organizationId`), the 400 -> 404 -> 403 order on rename, the response allowlist. Replace any
  `x-cache-allow` expectation with citadel's: GETs send `x-skip-cache`, writes send `x-cache-invalidate`.
- Port `owner-scoped.e2e-test-support.ts` (test-only `WidgetsTestController`) and `owner-scoped.e2e-spec.ts`
  (personal vs organization context resolved by the guard over the real service, 404-before-403). Same cache
  header adaptation. `WidgetsTestController` must stay out of `KNOWN_CONTROLLERS`.

## Files to Change
- `backend/src/auth/tests/support/in-memory-organization-repos.ts` — new (ported)
- `backend/src/auth/tests/support/in-memory-repo.ts` — reconcile
- `backend/src/auth/tests/support/build-auth-test-app.ts` — reconcile
- `backend/src/auth/tests/organization.controller.e2e-test-support.ts` — new (ported)
- `backend/src/auth/tests/organization.controller.create.e2e-spec.ts`, `.read.e2e-spec.ts`,
  `.rename.e2e-spec.ts`, `.not-found.e2e-spec.ts` — new (ported, adapted)
- `backend/src/auth/tests/owner-scoped.e2e-test-support.ts`, `owner-scoped.e2e-spec.ts` — new (ported, adapted)
