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
 * Modules register their own paths here (e.g. `['/bank/accounts', 'bank-accounts']`).
 * `Route` matches by equal segment count and the first match wins, so `/bank/accounts/new` is
 * listed before `/bank/accounts/:accountId` (likewise for `/bank/debts/new` and `/bank/investments/new`), and both
 * `/bank/providers/new` and `/bank/providers/accountant` come before `/bank/providers/:accountId`.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_CONTEXT = [
  ['/bank/accounts', 'bank-accounts'],
  ['/bank/accounts/new', 'bank-account-new'],
  ['/bank/accounts/:accountId/edit', 'bank-account-edit'],
  ['/bank/accounts/:accountId', 'bank-account'],
  ['/bank/debts', 'bank-debts'],
  ['/bank/debts/new', 'bank-debt-new'],
  ['/bank/debts/:accountId/edit', 'bank-debt-edit'],
  ['/bank/debts/:accountId', 'bank-debt'],
  ['/bank/investments', 'bank-investments'],
  ['/bank/investments/new', 'bank-investment-new'],
  ['/bank/investments/:accountId/edit', 'bank-investment-edit'],
  ['/bank/investments/:accountId', 'bank-investment'],
  ['/bank/providers', 'bank-providers'],
  ['/bank/providers/new', 'bank-provider-new'],
  ['/bank/providers/accountant', 'bank-provider-accountant'],
  ['/bank/providers/:accountId/edit', 'bank-provider-edit'],
  ['/bank/providers/:accountId', 'bank-provider'],
  ['/bank/bills/new', 'bank-bill-new'],
  ['/bank/bills/:billId/edit', 'bank-bill-edit'],
  ['/bank/bills/:billId/history', 'bank-bill-history'],
  ['/bank/calendar', 'bank-calendar'],
  ['/bank/calendar/month', 'bank-calendar-month'],
];

/**
 * Section registry for context switches: an ordered `[path prefix, list path]` list of
 * context-relative paths. A switch made from a page under a prefix lands on that section's list
 * in the new context; anything else lands on the new context's landing page. Each bank submenu
 * (Debts, Investments, Providers, Calendar) adds its own row here; the Providers
 * prefix also covers its hand-off page (`/bank/providers/accountant`). The one-off bill pages
 * (`/bank/bills/...`) have no list of their own: they land on the Providers list.
 *
 * @type {Array<Array<string>>}
 */
export const SECTIONS_CONTEXT = [
  ['/bank/accounts', '/bank/accounts'],
  ['/bank/debts', '/bank/debts'],
  ['/bank/investments', '/bank/investments'],
  ['/bank/providers', '/bank/providers'],
  ['/bank/bills', '/bank/providers'],
  ['/bank/calendar', '/bank/calendar'],
];
