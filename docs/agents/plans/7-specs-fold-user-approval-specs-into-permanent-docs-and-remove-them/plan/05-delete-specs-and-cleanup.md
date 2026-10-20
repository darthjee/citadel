# Delete the specs and clean up references

- Delete `docs/agents/specs/user-approval/` (all files, including `api/` and `ui/`).
- `docs/agents/specs.md`: Active specs reads "none"; Completed specs gets a table row for User
  approval, pointing at `modules/auth/user-approval.md` and Epic #1.
- `backend/src/auth/tests/auth.controller.user-status.e2e-spec.ts` line 22: repoint the comment
  from "the user-approval specs (security.md, errors.md, model.md)" to the permanent docs
  (`docs/agents/modules/auth/user-approval.md`).
- `docs/agents/summary.md` and `docs/agents/index.md`: add `modules/auth/user-approval.md` and
  `backend/routes/admin.md`; fix "(`auth.md` today)" in the Routes summary.
- Run the grep from the plan's Notes and fix anything left.

## Files to Change
- `docs/agents/specs/user-approval/` — deleted
- `docs/agents/specs.md` — Active "none", Completed entry
- `backend/src/auth/tests/auth.controller.user-status.e2e-spec.ts` — comment only
- `docs/agents/summary.md`, `docs/agents/index.md` — new pages listed
