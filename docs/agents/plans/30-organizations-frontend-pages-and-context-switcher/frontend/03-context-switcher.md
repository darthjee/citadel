# Context switcher and header

1. **Move the switcher** from `code_sample/.../common/header/contextSwitcher/` to
   `frontend/assets/js/components/common/header/contextSwitcher/`. Change only comments: the
   `ContextSwitcher` JSDoc mentions "a bank accounts page", and the `ContextSwitcherController` JSDoc
   mentions "#49 onwards". Make both generic. The files are:
   - `ContextSwitcher.jsx`: hidden while logged out or pending. It reads `context`, `userId`, `orgs`
     and `orgsError` from `useOwnerContext()`, computes `switchTargetFor(currentHash())`, and delegates
     to the helper.
   - `controllers/ContextSwitcherController.js`: `pick(context, userId, switchTarget)` stores the
     picked context in `ContextStorage` (`rememberOrganization` or `rememberPersonal`) **before**
     navigating to the target.
   - `helpers/ContextSwitcherHelper.jsx`:
     - a `NavDropdown` with `id="context-switcher"`;
     - Personal first, then the organizations, then **+ Create organization** (`#/orgs/new`);
     - the active item checked;
     - text truncation with `title`;
     - the `NEUTRAL_TITLE` and `ORGS_ERROR_MESSAGE` exports.
2. **Mount it in `HeaderHelper.jsx`**, as ward does: import `ContextSwitcher` and render
   `<ContextSwitcher loggedIn={isLoggedIn} pending={pending} />` as the **first** child of the left
   `<Nav className="me-auto">`, before `renderAuthLinks(...)`.
   - Keep citadel's current link layout. Do not port ward's `BankMenu` or the split into a right-aligned
     `ms-auto` account `Nav`.
   - Update the `render` JSDoc.
   - `Header.jsx` is identical to the sample, so leave it unchanged and delete the sample copy.
3. **Specs:**
   - Port ward's three switcher specs: `ContextSwitcherSpec.js`, `ContextSwitcherControllerSpec.js` and
     `ContextSwitcherHelperSpec.js`.
   - Adapt every bank or section assertion to citadel, where `SECTIONS_CONTEXT` is empty and the
     switch target is the context's landing page. Where a spec needs a section, pass a fixture
     `sections` list or a fixture `switchTarget`.
   - Extend `HeaderHelperSpec.js` with ward's switcher cases, minus `ms-auto`:
     - the markup contains no `context-switcher` when logged out or pending;
     - logged in, it contains `id="context-switcher"`, placed before the auth links (Logout / My
       account).

     Rendering `ContextSwitcher` inside `HeaderHelper` needs an owner context. Default values
     outside a provider are fine (check `DEFAULT_OWNER_CONTEXT` in `useOwnerContext.js`); otherwise
     wrap the element in `OwnerContext.Provider` in the spec.
   - Make sure `HeaderSpec.js` still passes.

## Files to Change

- `frontend/assets/js/components/common/header/contextSwitcher/ContextSwitcher.jsx`: new.
- `frontend/assets/js/components/common/header/contextSwitcher/controllers/ContextSwitcherController.js`:
  new.
- `frontend/assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelper.jsx`: new.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`: render the switcher first in
  the left `Nav`.
- `frontend/specs/assets/js/components/common/header/contextSwitcher/ContextSwitcherSpec.js`: new (from
  ward).
- `frontend/specs/assets/js/components/common/header/contextSwitcher/controllers/ContextSwitcherControllerSpec.js`:
  new (from ward).
- `frontend/specs/assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelperSpec.js`:
  new (from ward).
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js`: add the switcher
  cases.
- Delete `docs/agents/specs/orgs/code_sample/frontend/assets/js/components/common/header/` (including
  the sample `Header.jsx`).
