# Specs

Write Jasmine specs under `frontend/specs/assets/js/...`, mirroring the source paths. Use the existing support
helpers: `fetchSequence`, `flushMicrotasks`, `fakeWindow` and `renderCapturingHandlers`.

## `TodoClient`

- Each method's method, path and body, in personal and organization contexts.
- `updateItem` keeps `done: false`.
- A 204 delete resolves.

## `orgPermissions`

- `MANAGE_LISTS`: `user` is denied; `admin` and `owner` are allowed; a `null` role is denied.

## Routing

- `RouteSpec`, `HashRouteResolverSpec` or `routes`:
  - each `todo` path resolves to its page key in both contexts;
  - `/todo/lists/new` is not read as `:id`.
- `sectionTargetSpec`: switching context from `#/todo/lists/5` or `#/orgs/1/todo/lists/5/edit` lands on the new
  context's `/todo/lists`.

## Pages

**`TodoLists`:**

- renders the lists and their `items_count`;
- hides "New list" for `user` and shows it for `admin`;
- renders `NotFound` on a 404.

**`TodoListNew` / `TodoListEdit`:**

- render `PermissionDenied` for `user`;
- show 400 field errors;
- navigate on success.

**`TodoListShow`:**

- item controls are shown or hidden per role (`user` sees toggle, edit and add, but not item or list delete, nor
  rename);
- toggling `done` sends `{ done }`;
- a 409 on list delete shows the message and stays on the page;
- a 404 renders `NotFound`.

## Header

- The "To-do" link appears only when logged in.
- Its href follows the context (personal vs. org).

## Files to Change

- `frontend/specs/assets/js/client/TodoClientSpec.js`: new.
- `frontend/specs/assets/js/utils/permissions/orgPermissionsSpec.js`: extend.
- `frontend/specs/assets/js/utils/routing/*Spec.js`: extend.
- `frontend/specs/assets/js/components/resources/todo/pages/**`: new.
- `frontend/specs/assets/js/components/common/header/**`: extend.
