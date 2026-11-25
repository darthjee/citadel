# Architect Plan: Organizations: docs fold and spec cleanup (wrap-up)

Main plan: [plan.md](plan.md)

## Shared contracts

- Creates `docs/agents/architecture/owner-context.md` and `docs/agents/backend/routes/orgs.md`, and
  expands `docs/agents/modules/auth/organizations.md`. The backend's comments may point at
  `architecture/owner-context.md`.
- `todo` replaces `bank` as the example module everywhere.
- After this PR the repo contains no `specs/orgs`, `code_sample`, `bank` (as an example module),
  `ward` or original-project issue numbers.

## Steps

- [01 — Check the precondition and inventory the spec](architect/01-precondition-and-inventory.md)
- [02 — Write architecture/owner-context.md](architect/02-owner-context-page.md)
- [03 — Expand modules/auth/organizations.md](architect/03-organizations-module-page.md)
- [04 — Add backend/routes/orgs.md](architect/04-orgs-routes-page.md)
- [05 — Fold security and caching rules](architect/05-security-and-caching.md)
- [06 — Indexes, product definitions and agent files](architect/06-indexes-and-product.md)
- [07 — Complete the spec and delete the folder](architect/07-complete-spec-and-delete.md)

## Notes

- **Condense.** Keep rules, invariants, contracts and rationale. Drop repetition across pages, worked
  examples, "Hub:" back-links, reading orders and every "What is not documented in the repository"
  section. Aim for roughly 1/4–1/3 of the spec's ~5,000 lines in total.
- **The code wins.** Before folding a statement, check it against the code (e.g.
  `backend/src/core/owner-context.guard.ts`, `backend/src/auth/organization*.ts`,
  `backend/src/core/cache-*.ts`, `frontend/assets/js/utils/context/`). Fold the corrected fact or drop
  it; never fold out-of-date spec text. `CacheTokenService` is a known example: describe what it
  actually does after #33.
- **No roadmap.** Drop `roadmap.md` and every future-epic mention (joining, closing, creation rate
  limit, moving or sharing records, authorship). Where the limitation is real today (e.g. "no
  organization can be deleted", "no member management", "no creation cap"), state it as a current
  limitation, without issue numbers or links.
- `examples.md` and the four `code-sample*.md` pages are dropped. A single request/response sample
  per route in `routes/orgs.md` is optional.
- This plan names the architect (normally the coordinator) as an implementing agent on purpose. The
  issue assigns all documentation work to it, and no specialist owns `docs/agents/`.
