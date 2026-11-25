# Header link

Add a "To-do" `Nav.Link` in `HeaderHelper.jsx`. It goes right after the `ContextSwitcher` and only shows when the
user is logged in (and not `pending`).

- **Its href follows the active context:** `contextHash(context, '/todo/lists')`, which gives `#/todo/lists` or
  `#/orgs/<id>/todo/lists`.
- **Where the context comes from:**
  - `HeaderHelper.render` currently takes positional args, so add the context, or a precomputed `todoHref`, as an
    argument;
  - `Header.jsx` and `HeaderController` supply it from `useOwnerContext()`.
- **Fallback:** if the provider is not mounted above the header, fall back to `#/todo/lists`.

## Files to Change

- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`: the link.
- `frontend/assets/js/components/common/header/Header.jsx` (and `controllers/HeaderController.js`, if needed): pass
  the context or href.
