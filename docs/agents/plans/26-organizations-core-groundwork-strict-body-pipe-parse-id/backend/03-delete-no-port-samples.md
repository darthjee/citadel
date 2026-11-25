# Delete no-port sample copies

Before deleting, re-verify each file still matches the expectation with `diff <citadel file> <sample file>`:
identical, or only `WARD_*` → `CITADEL_PLACEHOLDER_*` env-name differences, or (for `error-codes.ts`) only
`bank`-specific codes added. If any file shows another difference, keep it and flag it in the PR description
instead of deleting it.

Delete from `docs/agents/specs/orgs/code_sample/`:

- identical: `backend/src/core/admin.guard.ts`, `admin-only.decorator.ts`, `boolean-metadata.ts`,
  `access-token-payload.ts`, `current-user.decorator.ts`, `public.decorator.ts`, `session-lookup.ts`,
  `cache-policy.decorator.ts`, `backend/src/database/migrations/helpers.ts`, `backend/src/core/tests/admin.guard.spec.ts`,
  `current-user.decorator.spec.ts`, `http-exception.filter.spec.ts`
- env-prefix-only: `backend/src/core/jwt.guard.ts`, `cache-token.service.ts`, `secret-keys.ts`,
  `backend/src/core/tests/app.module.spec.ts`, `jwt.guard.spec.ts`, `cache-token.service.spec.ts`
- bank-only codes: `backend/src/core/error-codes.ts`

**Keep**: `cache-class.ts`, `cache-policy.interceptor.ts` (→ #33); `cache-invalidation.*` and every
owner-context/org file (→ #27, #28).

Update the sample index pages so no row links to a deleted file: in `docs/agents/specs/orgs/code-sample-backend.md`
(and the file count in `code-sample.md`), mark each removed row as "already in citadel, no port" or
"ported in #26" with the real path, instead of a dead `code_sample/` link.

## Files to Change
- the 19 sample files listed above: deleted
- `docs/agents/specs/orgs/code-sample-backend.md`: rows updated
- `docs/agents/specs/orgs/code-sample.md`: counts updated
