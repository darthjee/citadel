# Document the owner-context mechanism

Fold what matters from `docs/agents/specs/orgs/owner-context.md` / `roles.md` into the permanent docs. Keep it
concise and link back to the spec pages; #32 does the final fold and cleanup.

1. `docs/agents/architecture/backend.md`:
   - **Layout**: list the new `core/` files.
   - New section **"Owner context"** after "Admin Guard". Cover:
     - the global chain order (`OriginGuard` -> `JwtGuard` -> `OwnerContextGuard` -> `AdminGuard`);
     - the check order (404 before 403, the uniform 404 for unknown, foreign or malformed ids and for
       non-members, global admins included);
     - no role caching, and the role never taken from input;
     - the personal context counting as `owner`;
     - `ownerWhere()`/`ownerSqlWhere()` as the only way to filter by owner;
     - `@OwnerScopedController(path)` bundling both prefixes, scoping, `user-scoped` cache class and
       `InvalidatesOwner()`;
     - `@CurrentOwner()`, `@MinOrgRole()`, and the `core/`-never-imports-`auth/` port, with the fail-closed
       default until #28.
   - **Testing**: mention the three coverage specs, and that the "> 0 routes" assertion returns with #31.
2. `docs/agents/architecture/caching.md`, **Invalidation** section: the backend now emits `X-Cache-Invalidate` on
   successful writes of routes declaring `InvalidatesOwner()`/`InvalidatesPaths()`. The proxy does not consume
   it yet (#33); Tent's `CacheCleanupMiddleware` stays the only active invalidation. Note that owner-scoped
   controllers are `user-scoped`, so they send `X-Skip-Cache`.
3. `docs/agents/specs/orgs/owner-context.md`: in "What is not documented in the repository", answer the
   questions the port now settles, pointing at `backend/src/core/`:
   - the context lives on `request.ownerContext`;
   - `MembershipView` is just `OrgRole | null` from `findRole()`;
   - `ownerSqlWhere` returns `{ sql, params }`.
   Keep the edit minimal.

## Files to Change

- `docs/agents/architecture/backend.md`: Layout, new "Owner context" section, Testing.
- `docs/agents/architecture/caching.md`: Invalidation.
- `docs/agents/specs/orgs/owner-context.md`: answered open questions.
