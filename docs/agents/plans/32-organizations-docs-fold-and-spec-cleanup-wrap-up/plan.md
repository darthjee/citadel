# Plan: Organizations: docs fold and spec cleanup (wrap-up)

Issue: [32-organizations-docs-fold-and-spec-cleanup-wrap-up.md](../../issues/32-organizations-docs-fold-and-spec-cleanup-wrap-up.md)

## Overview

Close epic #25 by folding the lasting content of `docs/agents/specs/orgs/` into the permanent docs,
condensed and adapted to citadel. Organization-specific content goes into
`modules/auth/organizations.md` and a new `backend/routes/orgs.md`. Cross-cutting rules go into a new
`architecture/owner-context.md` plus the `security.md`/`caching.md` architecture pages. Then delete
the spec folder, move Organizations to "Completed specs" in `specs.md`, and fix every link, anchor,
index entry and code comment that pointed at the spec or the `bank` sample. Nothing changes
behaviour; the only source edits are comments.

**Precondition:** #33 (Per-user cache) is merged and `docs/agents/specs/orgs/code_sample/` is empty.
If not, stop and report (see the architect's step 01).

## Agents involved

- [architect](architect.md): all documentation, including `.claude/agents/architect.md` and
  `.claude/agents/product-owner.md`.
- [backend](backend.md): three comment-only source edits.

## Shared contracts

- **New permanent doc paths** (created by the architect; the backend comments may reference them
  before they exist, since both land in the same PR):
  - `docs/agents/architecture/owner-context.md`: the owner-context mechanism and organization roles;
  - `docs/agents/modules/auth/organizations.md`: the organizations module (existing, expanded);
  - `docs/agents/backend/routes/orgs.md`: the `/orgs` routes.
- **Example module name**: every former `bank` example becomes `todo` (routes `/todo/*.json` and
  `/orgs/:orgId/todo/*.json`; todo lists → items, matching the former accounts → transactions).
- **Forbidden references after this PR**: `specs/orgs`, `code_sample`, `bank` (as an example
  module), `ward`, and the original project's issue numbers, anywhere in the repo.
