# Plan: Specs: fold user approval specs into permanent docs and remove them

Issue: [7-specs-fold-user-approval-specs-into-permanent-docs-and-remove-them.md](../../issues/7-specs-fold-user-approval-specs-into-permanent-docs-and-remove-them.md)

## Overview

Docs-only close-out of the user-approval Epic (#1). Move the lasting content of
`docs/agents/specs/user-approval/` into the permanent docs, describing the merged code (#3, #4,
#5, #12, #6, #14) rather than the spec text, then delete the specs folder and every reference to
it.

## Context

- Decisions taken in the issue discussion: the new feature page is
  `docs/agents/modules/auth/user-approval.md`, next to `modules/auth.md` (which stays in place,
  so no existing link changes); the admin route reference is a new
  `docs/agents/backend/routes/admin.md`.
- Spec "Required tests" sections, the sub-issue / port-order tables and "What Citadel adds" are
  not carried over. Kerghan is linked only by GitHub URL (never a local path), in a Reference
  section of `user-approval.md`.
- Where a spec and the code disagree, read the code and document the code.

## Steps

- [01 — Product decision and the feature page](plan/01-product-and-feature-page.md)
- [02 — Auth module page](plan/02-auth-module-page.md)
- [03 — Route reference](plan/03-route-reference.md)
- [04 — Security, frontend and env var docs](plan/04-security-frontend-env.md)
- [05 — Delete the specs and clean up references](plan/05-delete-specs-and-cleanup.md)

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_be yarn lint` — only a comment changes
  in one e2e spec; no other CI job is affected by docs.

## Notes

- Read each spec file next to the code it describes before writing; the code is the source of
  truth now.
- Final check: `grep -rn "specs/user-approval" --exclude-dir=node_modules --exclude-dir=.git .`
  must match only the Completed specs entry in `docs/agents/specs.md` (and the issue/plan files
  of #7, which are removed when it merges).
