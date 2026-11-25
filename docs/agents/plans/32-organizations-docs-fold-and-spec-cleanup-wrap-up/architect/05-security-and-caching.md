# Fold security and caching rules

## Security

Add an **Owner-scoped data** section to `docs/agents/architecture/security.md`, folded from the
spec's `security.md` (and the checklist parts of `tests.md`):

- the uniform 404 / 403 contract (non-disclosure of other organizations' existence);
- no client-supplied owner or role: the owner comes only from the URL plus membership lookup;
- the global `is_admin` grants nothing inside organizations;
- personal data is owner-only, never visible to organization members or to the global admin;
- the user reference on a record means owner, never creator;
- organization name validation (length counted in code points, control characters rejected) and
  safe rendering;
- what structural tests cannot catch;
- **the data-access review checklist**, kept here (not in `.claude/agents/data-access.md`).

Link `owner-context.md` for the mechanism instead of restating it.

## Caching

In `docs/agents/architecture/caching.md` (already rewritten for the per-caller model by #33), add
only the organization-specific rules that hold after #33:

- why owner-scoped GETs (including `/orgs*.json`) are never `public`;
- what `@OwnerScopedController()` bundles cache-wise;
- what invalidates on an organization write and on a role change;
- rules when adding an owner-scoped route;
- what caching does not protect.

Check each statement against `backend/src/core/cache-*.ts` and the proxy rules. Drop anything still
untrue instead of documenting it as future work.

## Files to Change

- `docs/agents/architecture/security.md`: new "Owner-scoped data" section with the data-access checklist
- `docs/agents/architecture/caching.md`: organization/owner-scoped caching rules
