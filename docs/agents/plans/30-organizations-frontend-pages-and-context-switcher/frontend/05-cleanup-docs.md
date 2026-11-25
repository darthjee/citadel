# Cleanup and docs

1. **Sample cleanup:** after steps 01–04, `docs/agents/specs/orgs/code_sample/frontend/` must be empty.
   Remove the directory. Leave `code_sample/backend/` alone, since #31 and #33 still use it.
2. **`docs/agents/specs/orgs/code-sample-frontend.md`:**
   - In sections 6, 7, 8 and 9, mark every row as **ported in #30** with its real path, in the same
     style #29 used for sections 1–5.
   - Update the links to point at the real files under `frontend/` instead of `./code_sample/...`.
   - Note under section 7 that `HeaderHelper.jsx` was reconciled from ward to mount the switcher.
   - Note under section 6 that `validateOrganizationName` comes from ward, not the sample.
   - Set the checklist to Pages `#30`, Header and switcher `#30`, Shared pieces `#30` and Specs
     "11 in #29; 5 in #30".
3. **`docs/agents/specs/orgs/code-sample.md`:**
   - Update the frontend row and the status paragraph (around line 25) to say the frontend is fully
     ported.
   - Remove `frontend/` from the remaining `code_sample/` tree listing.
4. **`docs/agents/modules/auth/organizations.md`:** extend the `## Frontend` section, added in #29,
   with subsections for:
   - **Pages** (`resources/organizations/pages/`): the three routes, what each page shows, Rename
     gating (`admin`/`owner`), the `403` message, `404` → Not-found, and `refreshOrgs()` after
     create/rename before navigating to the overview.
   - **Context switcher** (`common/header/contextSwitcher/`): its entries, the checked active entry,
     truncation with `title`, the neutral title, the inline error on an `/orgs.json` failure,
     remember-before-navigate, and `switchTargetFor`. Mention that `HeaderHelper` mounts it first in
     the left nav.
   - **Not found and permission denied:** one view for a malformed id and a `404`, and that it
     forgets a stale remembered id.
   - **Remount on context change:** `AppHelper` keys the page by `contextKey(route.context)`.
   - **Name validation:** `validateOrganizationName` (required, 255 code points); the backend stays
     authoritative.
5. **`docs/agents/architecture/frontend.md`:**
   - Add `resources/organizations/pages/`, `common/header/contextSwitcher/`, `common/notFound/` and
     `common/PermissionDenied.jsx` to the folder tree.
   - In "Routing and owner context", add that `AppHelper.render(route)` keys the page by owner
     context, and that the `not-found` key renders `NotFound`.

## Files to Change

- `docs/agents/specs/orgs/code_sample/frontend/`: removed (empty after the moves).
- `docs/agents/specs/orgs/code-sample-frontend.md`: sections 6–9 and the checklist mark #30.
- `docs/agents/specs/orgs/code-sample.md`: the frontend is fully ported.
- `docs/agents/modules/auth/organizations.md`: Frontend section covering the pages, the switcher,
  Not-found, the remount and validation.
- `docs/agents/architecture/frontend.md`: folder tree and routing notes.
