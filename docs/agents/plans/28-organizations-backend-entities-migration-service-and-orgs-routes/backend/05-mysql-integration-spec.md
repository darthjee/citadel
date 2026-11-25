# MySQL integration spec

New `auth/tests/integration/organization.service.integration-spec.ts`, following
`session.service.integration-spec.ts`: `createTestDataSource()`, `resetDatabase()`, `runMigrations()`, real
repositories, `new OrganizationService(...)`, users seeded with `randomUUID()` usernames.

Cover what the in-memory repos cannot prove:

- `create` writes the organization and exactly one `owner` membership, and rolls both back when the
  membership insert fails (e.g. a non-existent user id violating the foreign key).
- `listForUser` (ordered by id, with roles), `findMembership`, `findRole` (null for a non-member), `rename`
  (persists; 404 for a non-member, 403 for a `user`).
- The unique `(organization_id, user_id)` index rejects a second membership row.
- `ON DELETE RESTRICT`: deleting a user or an organization that still has a membership fails.

The routes and the guard's 404-before-403 contract stay covered by the in-memory e2e specs (step 04); no app
boot on MySQL.

## Files to Change
- `backend/src/auth/tests/integration/organization.service.integration-spec.ts` — new
