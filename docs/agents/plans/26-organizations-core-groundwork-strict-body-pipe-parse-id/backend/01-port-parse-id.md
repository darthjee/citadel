# Port parseId

Move `docs/agents/specs/orgs/code_sample/backend/src/core/parse-id.ts` to `backend/src/core/parse-id.ts` unchanged (`MAX_ID`, `ownerNotFound()`,
`parseId()`), and `docs/agents/specs/orgs/code_sample/backend/src/core/tests/parse-id.spec.ts` to `backend/src/core/tests/parse-id.spec.ts`. The spec
already covers valid ids up to `MAX_ID`; `abc`, `007`, `0`, `-1`, `1.5`, `1e3`, `+1`, `' 1'`, `''`, overflow and
non-strings → `NotFoundException`; and that the thrown body equals `ownerNotFound()`'s. Add the JSDoc note that
`MAX_ID` is tied to citadel's signed `int` ids (a derived project moving to `bigint` must raise it) only if
lint/JSDoc rules require nothing different from the original; otherwise keep the note in the docs (step 04).
Delete both files from `code_sample/` once moved.

## Files to Change
- `backend/src/core/parse-id.ts`: new (moved from the sample)
- `backend/src/core/tests/parse-id.spec.ts`: new (moved from the sample)
- `docs/agents/specs/orgs/code_sample/backend/src/core/parse-id.ts`, `docs/agents/specs/orgs/code_sample/backend/src/core/tests/parse-id.spec.ts`: deleted
