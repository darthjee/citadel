# Entities and migration

Port the two entities and the migration, and reconcile `user.entity.ts`.

- Move `auth/entities/organization.entity.ts` and `auth/entities/organization-membership.entity.ts` from
  `code_sample/backend/src/` unchanged except for "Ward" wording (`MembershipRole` stays as in the sample).
- Reconcile `auth/entities/user.entity.ts`: the only sample differences are ward's `locale` column, its
  `UserLocale` import and the "A Ward account" comment. None of them is organization-related, so the citadel
  file stays as it is. Add a relation only if the ported entities require an inverse side (they do not in the
  sample).
- Move `database/migrations/20261107120015-auth-create-organizations.ts` (class
  `AuthCreateOrganizations20261107120015`); it already sorts after `20261019120014` and imports the existing
  `helpers.ts`. Tables `auth_organizations` / `auth_organization_memberships`, unique index
  `(organization_id, user_id)`, `user_id` index, both foreign keys `ON DELETE RESTRICT`; `down()` drops both.
- New `database/tests/auth-create-organizations-migration.spec.ts`, using `fake-query-runner.ts` like the specs
  for migrations 11 to 14: `up` creates both tables (call order, column names/types, index names, unique flag,
  foreign keys with `RESTRICT`), `down` drops memberships then organizations. Extend `fake-query-runner.ts`'s
  `METHODS` only if the migration calls a method it lacks (e.g. `createForeignKey`).
- Register the entities wherever citadel lists entities (`AuthModule`'s `TypeOrmModule.forFeature`, step 03,
  and `database/data-source.ts` / the integration `test-data-source.ts` if they enumerate entities rather than
  glob them).

## Files to Change
- `backend/src/auth/entities/organization.entity.ts` — new (ported)
- `backend/src/auth/entities/organization-membership.entity.ts` — new (ported)
- `backend/src/database/migrations/20261107120015-auth-create-organizations.ts` — new (ported)
- `backend/src/database/tests/auth-create-organizations-migration.spec.ts` — new
- `backend/src/database/tests/fake-query-runner.ts` — only if a method is missing
- `backend/src/database/data-source.ts`, `backend/src/database/tests/integration/test-data-source.ts` — only if they list entities explicitly
