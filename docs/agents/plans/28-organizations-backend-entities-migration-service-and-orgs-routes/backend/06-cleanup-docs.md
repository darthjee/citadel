# Delete ported samples and fold docs

- Delete from `docs/agents/specs/orgs/code_sample/backend/src/`: every `auth/` file this issue ported or
  reconciled (`auth.module.ts`, `dto/organization-name.dto.ts`, `entities/*`, `organization*.ts`, all
  `auth/tests/*` and `auth/tests/support/*`), and
  `database/migrations/20261107120015-auth-create-organizations.ts`. Keep `bank/tests/*` (#31) and
  `core/cache-class.ts`, `core/cache-policy.interceptor.ts` (#33).
- Update `docs/agents/specs/orgs/code-sample-backend.md`, `code-sample-migrations.md` and `code-sample.md`: link
  the moved files to their real paths, mark them ported in #28, drop the `no-organization-membership-lookup`
  row, keep the counts right.
- New `docs/agents/modules/auth/organizations.md`: tables and constraints, `OrganizationService` rules (only
  membership writer, owner at birth in one transaction, rename needs `admin`), the four routes with their
  status order, response allowlist, cache classes and invalidations, and the `ORGANIZATION_MEMBERSHIP_LOOKUP`
  binding in `AuthModule`. Link it from `docs/agents/modules/auth.md` (routes table, services, entities).
- `docs/agents/architecture/backend.md`: drop the `no-organization-membership-lookup.ts` tree entry and rewrite
  the "Until the organizations backend lands (#28)..." paragraph to say `AuthModule` binds the port to
  `OrganizationService`.
- `docs/agents/architecture/caching.md`: list the `/orgs` routes' classes if it enumerates routes.

## Files to Change
- `docs/agents/specs/orgs/code_sample/backend/src/auth/**`, `.../database/migrations/20261107120015-auth-create-organizations.ts` — delete
- `docs/agents/specs/orgs/code-sample-backend.md`, `code-sample-migrations.md`, `code-sample.md` — update
- `docs/agents/modules/auth/organizations.md` — new
- `docs/agents/modules/auth.md` — link and summarize
- `docs/agents/architecture/backend.md` — port binding wording
- `docs/agents/architecture/caching.md` — only if it enumerates routes
