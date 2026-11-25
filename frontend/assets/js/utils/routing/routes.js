/**
 * Route tables for the context-aware hash router. Each table is an ordered `[path, page key]`
 * list matched top-to-bottom, so more specific paths must be listed before their more generic
 * siblings.
 */

/**
 * Personal-only routes, matched first against the full path (so `/orgs/new` is never read as an
 * organization id). `'/'` → `'home'` stays last.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_PERSONAL = [
  ['/orgs/new', 'org-new'],
  ['/recover-password', 'reset-password'],
  ['/admin/users/:id/edit', 'admin-user-edit'],
  ['/admin/users', 'admin-users'],
  ['/account/authorization-requests', 'authorization-requests'],
  ['/account/my-account', 'my-account'],
  ['/', 'home'],
];

/**
 * Organization-only routes, matched against the path left after the `/orgs/<id>` prefix.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_ORG_ONLY = [
  ['/', 'org-overview'],
  ['/edit', 'org-edit'],
];

/**
 * Context-aware routes, valid both as Personal (`/x`) and under an organization (`/orgs/<id>/x`).
 * Modules register their own paths here (e.g. `['/module/items', 'module-items']`).
 * `Route` matches by equal segment count and the first match wins, so a static path such as
 * `/module/items/new` must be listed before a parameterized sibling like `/module/items/:id`.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_CONTEXT = [
  ['/todo/lists/new', 'todo-list-new'],
  ['/todo/lists/:id/edit', 'todo-list-edit'],
  ['/todo/lists/:id', 'todo-list-show'],
  ['/todo/lists', 'todo-lists'],
];

/**
 * Section registry for context switches: an ordered `[path prefix, list path]` list of
 * context-relative paths. A switch made from a page under a prefix lands on that section's list
 * in the new context; anything else lands on the new context's landing page. Each module adds
 * its own rows here (e.g. `['/module/items', '/module/items']`); a prefix without a list of its
 * own may point at a sibling section's list.
 *
 * @type {Array<Array<string>>}
 */
export const SECTIONS_CONTEXT = [
  ['/todo/lists', '/todo/lists'],
];
