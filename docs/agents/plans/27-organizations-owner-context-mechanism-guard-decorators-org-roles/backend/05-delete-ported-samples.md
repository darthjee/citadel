# Delete the ported samples and update the sample indexes

Once steps 01–04 are green, remove every `code_sample/` file this issue ported, and point the indexes at the real
files, as #26 did.

1. Delete from `docs/agents/specs/orgs/code_sample/backend/src/core/`:
   - `cache-invalidation.decorator.ts`, `cache-invalidation.interceptor.ts`, `current-owner.decorator.ts`,
     `min-org-role.decorator.ts`, `org-role.ts`, `organization-membership-lookup.ts`, `owner-context.guard.ts`,
     `owner-context.ts`, `owner-scoped.decorator.ts`, `parse-org-id.ts`;
   - `tests/cache-invalidation.decorator.spec.ts`, `tests/current-owner.decorator.spec.ts`,
     `tests/min-org-role.coverage.spec.ts`, `tests/org-role.spec.ts`, `tests/owner-context.guard.spec.ts`,
     `tests/owner-context.spec.ts`, `tests/owner-scoped.decorator.spec.ts`, `tests/owner-scoped.module.e2e-spec.ts`,
     `tests/parse-org-id.spec.ts`, `tests/support/route-discovery.ts`.
   **Keep** `cache-class.ts` and `cache-policy.interceptor.ts` (owned by #33).
2. Update `docs/agents/specs/orgs/code-sample-backend.md`:
   - point each ported row at `../../../../backend/src/core/...` with a "**ported in #27**" note, as the #26 rows do;
   - fix the `min-org-role.coverage.spec.ts` row, which wrongly says it covers plain `@Body()`/`public`. It covers
     `@MinOrgRole`; add rows for the new `owner-scoped.coverage.spec.ts`, `cache-invalidation.coverage.spec.ts`
     and `cache-invalidation.interceptor.spec.ts`;
   - drop the "org-specific codes, if any, come with #27" remark on the `error-codes.ts` row: there are none.
3. Update `docs/agents/specs/orgs/code-sample.md` if it lists the core files or a count.
4. Grep `docs/agents/specs/orgs/` for links to the deleted paths and repoint or remove them.

## Files to Change

- `docs/agents/specs/orgs/code_sample/backend/src/core/**`: the files listed above deleted.
- `docs/agents/specs/orgs/code-sample-backend.md`: rows repointed and corrected.
- `docs/agents/specs/orgs/code-sample.md`: index refreshed if needed.
- Any `docs/agents/specs/orgs/*.md` linking a deleted sample path.
