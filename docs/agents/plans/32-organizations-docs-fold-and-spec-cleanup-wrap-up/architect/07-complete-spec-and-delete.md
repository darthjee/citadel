# Complete the spec and delete the folder

1. **`docs/agents/specs.md`** (kept; it is the permanent hub). Following its Lifecycle step 4, without
   changing its rules:
   - remove the Organizations row from **Active specs**, which then reads "none";
   - add to **Completed specs**: feature "Organizations (domain data owned by a group of users instead
     of one user); specs were `specs/orgs/`, removed by #32", folded into
     [modules/auth/organizations.md](modules/auth/organizations.md),
     [architecture/owner-context.md](architecture/owner-context.md),
     [architecture/security.md](architecture/security.md),
     [architecture/caching.md](architecture/caching.md) and
     [backend/routes/orgs.md](backend/routes/orgs.md), epic
     [#25](https://github.com/darthjee/citadel/issues/25).
2. **Delete** `docs/agents/specs/orgs/` entirely (`git rm -r`). `docs/agents/specs/` then disappears
   from git. That is expected; do not add a placeholder file.
3. **Verify** (all must return nothing, excluding this issue's own issue and plan files):

   ```bash
   git grep -n "specs/orgs\|code_sample" -- ':!docs/agents/issues' ':!docs/agents/plans'
   git grep -n -i -w "bank\|ward" -- ':!docs/agents/issues' ':!docs/agents/plans'
   ```

   Then check every relative link and `#anchor` in the touched/new pages resolves, in particular
   `organizations.md#tables`, `#the-port-binding`, `#frontend`, `backend.md#owner-context`, and the
   new cross-links between `owner-context.md`, `organizations.md`, `routes/orgs.md`, `security.md` and
   `caching.md`.

## Files to Change

- `docs/agents/specs.md`: Organizations moves from Active to Completed
- `docs/agents/specs/orgs/`: deleted
