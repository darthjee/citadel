/**
 * Route tables for the context-aware hash router. Each table is an ordered `[path, page key]`
 * list matched top-to-bottom, so more specific paths must be listed before their more generic
 * siblings.
 */

/**
 * Personal-only routes, matched first against the full path (so a static `/orgs/<word>` path
 * listed here is never read as an organization id). `'/'` → `'home'` stays last.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_PERSONAL = [
  ['/recover-password', 'reset-password'],
  ['/admin/users/:id/edit', 'admin-user-edit'],
  ['/admin/users', 'admin-users'],
  ['/account/authorization-requests', 'authorization-requests'],
  ['/account/my-account', 'my-account'],
  ['/', 'home'],
];

/**
 * Organization-only routes, matched against the path left after the `/orgs/<id>` prefix.
 * The organization pages (overview, edit) register their rows here.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_ORG_ONLY = [];

/**
 * Context-aware routes, valid both as Personal (`/x`) and under an organization (`/orgs/<id>/x`).
 * Modules register their own paths here (e.g. `['/module/items', 'module-items']`).
 * `Route` matches by equal segment count and the first match wins, so a static path such as
 * `/module/items/new` must be listed before a parameterized sibling like `/module/items/:id`.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_CONTEXT = [];

/**
 * Section registry for context switches: an ordered `[path prefix, list path]` list of
 * context-relative paths. A switch made from a page under a prefix lands on that section's list
 * in the new context; anything else lands on the new context's landing page. Each module adds
 * its own rows here (e.g. `['/module/items', '/module/items']`); a prefix without a list of its
 * own may point at a sibling section's list.
 *
 * @type {Array<Array<string>>}
 */
export const SECTIONS_CONTEXT = [];
