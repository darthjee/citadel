# Backend Plan: Organizations: backend entities, migration, service and /orgs routes

Main plan: [plan.md](plan.md)

## Context

- #27 (merged) ships the owner-context mechanism in `backend/src/core/`: `OwnerContextGuard` (global
  `APP_GUARD`), `parseOrgId()` / `ownerNotFound()`, `org-role.ts` (`hasMinRole`, `orgRoleForbidden`),
  `InvalidatesPaths`, `CacheInvalidationInterceptor`, the shared `core/tests/support/route-discovery.ts`, and the
  fail-closed `NoOrganizationMembershipLookup` bound to `ORGANIZATION_MEMBERSHIP_LOOKUP` in `AppModule`.
- #26 (merged) ships `@StrictBody()` and `parseId()`.
- Approach: move then adapt, staying close to the sample; reconcile files that already exist in citadel
  rather than overwrite; delete each `code_sample/` file once ported.
- Citadel's cache model is `X-Skip-Cache` (no `X-Cache-Allow`, that is #33).
- Out of scope: `code_sample/backend/src/bank/tests/*` (stays for #31), roadmap items, the proxy (#33),
  the frontend (#29, #30).

## Steps

- [01 — Entities and migration](backend/01-entities-migration.md)
- [02 — Service, response, DTO, invalidation](backend/02-service-response-dto-invalidation.md)
- [03 — Controller, AuthModule and the port swap](backend/03-controller-module-port-swap.md)
- [04 — Test support and e2e specs](backend/04-test-support-e2e-specs.md)
- [05 — MySQL integration spec](backend/05-mysql-integration-spec.md)
- [06 — Delete ported samples and fold docs](backend/06-cleanup-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn lint` and `yarn build` (CI job: `backend_checks`)
- `backend`: `yarn test:integration` against the `citadel_placeholder_mysql_test` service via docker-compose
  (CI job: `backend_integration`)

Never run `yarn`/`npm`/`node` on the host; always through docker-compose.

## Notes

- ESLint `max-lines` is 300 per file; the sample files are all well under it.
- Keep the controller thin: every membership/role decision lives in `OrganizationService` (only `show`
  throws `ownerNotFound()` on a null lookup, as in the sample).
- Do not port ward's `locale` column from the sample `user.entity.ts` (nor `UserLocale`).
- Reviews: this issue adds endpoints and response fields, so the `security`, `data-access` and `cache`
  reviews apply (uniform 404, 400 -> 404 -> 403 order, response allowlist, `@CachePolicy` on every route,
  `X-Skip-Cache` on user-scoped GETs). Navi needs no new resource: no organization route is public.
