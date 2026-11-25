# Client, permission, routes

## Client

Add `frontend/assets/js/client/TodoClient.js`, following `OrganizationsClient.js`. Every method takes the active
`context` and builds its path with `contextPath(context, '/todo/...')` from `utils/context/ownerContext.js`, so the
same call hits `/todo/...` or `/orgs/<id>/todo/...`.

| Method | Request |
|---|---|
| `listLists(context)` | `GET lists.json` |
| `createList(context, name)` | `POST lists.json` |
| `showList(context, id)` | `GET lists/:id.json` |
| `renameList(context, id, name)` | `PATCH lists/:id.json` |
| `deleteList(context, id)` | `DELETE lists/:id.json` |
| `createItem(context, listId, { description, done })` | `POST lists/:listId/items.json` |
| `updateItem(context, listId, itemId, changes)` | `PATCH lists/:listId/items/:itemId.json` |
| `deleteItem(context, listId, itemId)` | `DELETE lists/:listId/items/:itemId.json` |

- `updateItem` sends only the defined fields. Use `pickDefined.js`, making sure `done: false` survives it.
- Make sure `ApiClient.deleteJson` handles a 204 with an empty body.

## Permission

In `utils/permissions/orgPermissions.js`:

- add `MANAGE_LISTS: 'manage_lists'` to `ACTIONS`;
- add `[ACTIONS.MANAGE_LISTS, ROLES.ADMIN]` to `MIN_ROLE`;
- update the `can()` doc comment.

## Routes

In `utils/routing/routes.js`:

- `ROUTES_CONTEXT`, with static paths before parameterized siblings:

  ```js
  ['/todo/lists/new', 'todo-list-new'],
  ['/todo/lists/:id/edit', 'todo-list-edit'],
  ['/todo/lists/:id', 'todo-list-show'],
  ['/todo/lists', 'todo-lists'],
  ```

- `SECTIONS_CONTEXT`: `['/todo/lists', '/todo/lists']`, so switching context while inside the module lands on the
  new context's list index. Check the row semantics in `utils/routing/sectionTarget.js`.

Then register the four page keys in `components/helpers/AppHelper.jsx`'s `PAGES` map.

## Files to Change

- `frontend/assets/js/client/TodoClient.js`: new.
- `frontend/assets/js/utils/permissions/orgPermissions.js`: add `MANAGE_LISTS`.
- `frontend/assets/js/utils/routing/routes.js`: add the `ROUTES_CONTEXT` entries and the `SECTIONS_CONTEXT` row.
- `frontend/assets/js/components/helpers/AppHelper.jsx`: register the page keys.
