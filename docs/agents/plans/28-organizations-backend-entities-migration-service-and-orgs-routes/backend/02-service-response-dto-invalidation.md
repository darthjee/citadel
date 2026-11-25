# Service, response, DTO, invalidation

Port the domain logic and its unit specs.

- `auth/organization.service.ts`: the only membership writer. `findRole` (implements
  `OrganizationMembershipLookup`), `findMembership`, `listForUser` (uses `In()`), `create` (organization plus
  one `owner` membership in one `manager.transaction`), `rename` (uniform 404 via `ownerNotFound()` for a
  non-member, uniform 403 via `orgRoleForbidden()` below `admin`). Imports from `core/` already exist (#27).
- `auth/organization-response.ts`: `serializeOrganization` allowlist `id`, `name`, caller `role`, timestamps.
- `auth/dto/organization-name.dto.ts`: `name` only (validated as in the sample).
- `auth/organization-invalidation.ts`: create invalidates `/orgs.json`; rename invalidates `/orgs.json` and
  `/orgs/<id>.json` (never `/orgs`).
- Specs: `organization.service.spec.ts`, `organization-name.dto.spec.ts`, `organization-response.spec.ts`,
  `organization-invalidation.spec.ts`. `repo-mock.test-support.ts` is identical in citadel, keep citadel's.
- Replace "Ward" wording with generic text.

## Files to Change
- `backend/src/auth/organization.service.ts` — new (ported)
- `backend/src/auth/organization-response.ts` — new (ported)
- `backend/src/auth/dto/organization-name.dto.ts` — new (ported)
- `backend/src/auth/organization-invalidation.ts` — new (ported)
- `backend/src/auth/tests/organization.service.spec.ts`, `organization-name.dto.spec.ts`,
  `organization-response.spec.ts`, `organization-invalidation.spec.ts` — new (ported)
