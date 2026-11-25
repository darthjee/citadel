# Port roles, owner context, parseOrgId and the membership port

Move the dependency-free building blocks first, with their specs.

1. Move from `docs/agents/specs/orgs/code_sample/backend/src/core/` to `backend/src/core/`, unchanged apart from
   generic comments:
   - `org-role.ts`: `OrgRole`, `hasMinRole()`, `orgRoleForbidden()`.
   - `owner-context.ts`: `OwnerScope`, `OwnerContext`, `ownerRole()`, `ownerWhere()`, `ownerSqlWhere()`.
   - `parse-org-id.ts`: `parseOrgId()`, `MAX_ORG_ID`, and the `ownerNotFound` re-export, built on #26's
     `parse-id.ts`.
   - `organization-membership-lookup.ts`: the `ORGANIZATION_MEMBERSHIP_LOOKUP` token and the
     `OrganizationMembershipLookup` interface. Replace "Ward's global admin" with "the global admin".
2. Add the **fail-closed default** lookup in `backend/src/core/no-organization-membership-lookup.ts`:
   `NoOrganizationMembershipLookup implements OrganizationMembershipLookup`, an `@Injectable()` whose
   `findRole()` always resolves `null`. Its doc comment explains that it keeps the app bootable before the
   organizations backend (#28) exists. Every `/orgs/:orgId/...` route then answers the uniform 404, and #28
   replaces the binding with `OrganizationService`.
3. Extend `backend/src/types/express.d.ts` with `ownerContext?: OwnerContext` on `Request` (type-only import from
   `../core/owner-context.js`), next to the existing `user`.
4. Move the specs `org-role.spec.ts`, `owner-context.spec.ts` and `parse-org-id.spec.ts` to `backend/src/core/tests/`,
   fixing import paths only. Add `no-organization-membership-lookup.spec.ts`: `findRole()` resolves `null` for any
   user/organization pair.

## Files to Change

- `backend/src/core/org-role.ts`: new (moved).
- `backend/src/core/owner-context.ts`: new (moved).
- `backend/src/core/parse-org-id.ts`: new (moved).
- `backend/src/core/organization-membership-lookup.ts`: new (moved).
- `backend/src/core/no-organization-membership-lookup.ts`: new, the fail-closed default.
- `backend/src/types/express.d.ts`: add `ownerContext?: OwnerContext`.
- `backend/src/core/tests/org-role.spec.ts`, `owner-context.spec.ts`, `parse-org-id.spec.ts`: new (moved).
- `backend/src/core/tests/no-organization-membership-lookup.spec.ts`: new.
