# Backend Plan: Organizations: docs fold and spec cleanup (wrap-up)

Main plan: [plan.md](plan.md)

## Shared contracts

- Point references at `docs/agents/architecture/owner-context.md` (created by the architect in the
  same PR).
- The example module is `todo`, never `bank`. No `specs/orgs`, `code_sample` or `ward` references may
  remain.

## Implementation Steps

### Step 1 — Rewrite the three spec-citing comments

Comment-only edits; no code, test logic or behaviour changes.

- `backend/src/todo/tests/support/owner-matrix.ts:6`: the comment points at
  `code_sample/.../bank/tests/support/owner-matrix.ts`. Describe the matrix in its own terms (todo
  lists → items) and, if a reference helps, point at `docs/agents/architecture/owner-context.md`.
- `backend/src/todo/tests/org-roles.e2e-spec.ts:18`: "ported from the organizations spec's bank
  sample". Drop the provenance and keep the description of the per-role matrix.
- `backend/src/core/owner-scoped.decorator.ts:28`: the JSDoc `@param` example `` `bank` `` →
  `` `todo` ``.

Afterwards, `git grep -n -i -w "bank\|ward" backend/` and `git grep -n "code_sample\|specs/orgs" backend/`
must return nothing.

### Step 2 — Lint

Run ESLint to make sure the comment edits keep the JSDoc and formatting rules happy.

## Files to Change

- `backend/src/todo/tests/support/owner-matrix.ts`: header comment
- `backend/src/todo/tests/org-roles.e2e-spec.ts`: header comment
- `backend/src/core/owner-scoped.decorator.ts`: JSDoc example

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI: `backend_checks`)

## Notes

- Never run `yarn` on the host; always use `docker-compose run`.
