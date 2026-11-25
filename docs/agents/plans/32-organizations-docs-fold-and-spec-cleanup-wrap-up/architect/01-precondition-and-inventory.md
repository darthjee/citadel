# Check the precondition and inventory the spec

1. **Precondition.** Confirm that #33 (Per-user cache) is merged into `main` and that
   `docs/agents/specs/orgs/code_sample/` contains no files
   (`find docs/agents/specs/orgs/code_sample -type f`). If any file remains, **stop**: do not delete
   anything, and report the leftover paths as an unmet dependency on #33 so they can be ported or
   explicitly waived. This is a hard stop, not a "list and justify".
2. **Inventory.** Read every page under `docs/agents/specs/orgs/` together with the current permanent
   docs: `modules/auth/organizations.md`, `modules/auth.md`, `modules/todo.md`,
   `architecture/backend.md`, `architecture/frontend.md`, `architecture/security.md`,
   `architecture/caching.md` (as rewritten by #33) and `backend/routes/*.md`. Note for each spec
   section whether it is (a) already covered, (b) to fold, and where (per the fold map in the issue),
   or (c) to drop. This working list drives steps 02–06 and is not committed.
3. **Reference baseline.** Record the current hits that must be gone by the end:

   ```bash
   git grep -n "specs/orgs\|code_sample" -- ':!docs/agents/specs/orgs' ':!docs/agents/issues' ':!docs/agents/plans'
   git grep -n -i -w "bank\|ward" -- ':!docs/agents/specs/orgs' ':!docs/agents/issues' ':!docs/agents/plans'
   ```

   Expected today: `docs/agents/specs.md:59`, `docs/agents/architecture/backend.md:14,190-191`,
   `docs/agents/modules/auth/organizations.md:8,184`, plus the three backend comments (backend
   agent).

## Files to Change

- None (read-only step).
