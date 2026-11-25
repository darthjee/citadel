# Pages

The pages go under `frontend/assets/js/components/resources/todo/pages/`, using the Page / `controllers/` / `helpers/`
split of `resources/organizations/pages/`. Every page:

- reads `{ context, role }` from `useOwnerContext()`;
- loads through `TodoClient` with the active context;
- renders `NotFound` on a 404 and `PermissionDenied` on a 403.

Never log names or descriptions.

## `TodoLists` (`todo-lists`)

- A table of the lists, with `name` linking to `contextHash(context, '/todo/lists/<id>')` and the `items_count`.
- A "New list" button, shown only when `can(role, MANAGE_LISTS)`.
- An empty state when there are no lists.

## `TodoListNew` (`todo-list-new`)

- A name form, rendering `PermissionDenied` unless `can(role, MANAGE_LISTS)`.
- Client-side checks mirror the backend (required, ≤ 255 characters); backend 400 `details` are shown per field.
- On success, navigate to the new list's show page.

## `TodoListShow` (`todo-list-show`)

- The list name, with "Rename" (`MANAGE_LISTS`) and "Delete list" (`DELETE`) controls.
- Items inline, ordered by id. Each has:
  - a `done` checkbox (`WRITE`), which sends a PATCH with `{ done }`;
  - inline edit of the description (`WRITE`);
  - delete (`DELETE`).
- An "Add item" form (`WRITE`).
- Deleting the list:
  - asks for confirmation;
  - on 204, navigates to the list index;
  - on 409 `LIST_HAS_ITEMS`, shows "Delete the list's items first" without leaving the page.
- After each item mutation, refresh from the response or reload the list.
- In personal context the role is `owner`, so every control shows.

## `TodoListEdit` (`todo-list-edit`)

- A rename form, preloaded with the current name, rendering `PermissionDenied` unless `can(role, MANAGE_LISTS)`.
- On success, navigate back to the show page.

Reuse `FormFieldsHelper.jsx` and `utils/validation/*` where they fit. Share the name form between new and edit, the
way `OrganizationFormHelper` is shared.

## Files to Change

- `frontend/assets/js/components/resources/todo/pages/TodoLists.jsx`, `TodoListNew.jsx`, `TodoListShow.jsx`,
  `TodoListEdit.jsx`: new.
- `frontend/assets/js/components/resources/todo/pages/controllers/*`: new (the loader, the form controllers, the item
  controller).
- `frontend/assets/js/components/resources/todo/pages/helpers/*`: new (the list table, the name form, the item rows).
