# Client layer

Port the organization client and reconcile the shared client files.

- Add `client/OrganizationsClient.js` (list `GET /orgs.json`, create `POST /orgs.json { name }`,
  read `GET /orgs/:orgId.json`, rename `PATCH /orgs/:orgId.json { name }`) and
  `client/PermissionEvents.js` (`emitForbidden()`, `onForbidden(handler)` returning an unsubscribe,
  `permission:forbidden` window event, SSR-safe).
- Reconcile `ApiClient.js`: requests with `body === undefined` are sent with no `body` option;
  on a `403`, `PermissionEvents.emitForbidden()` runs before throwing. Keep citadel's existing
  `skipAuthRecovery`/retry behaviour.
- Reconcile `AuthEvents.js` (4th `userId = null` argument, in the event detail) and `AuthStatus.js`
  (forward `userId ?? null` on the logged-in branch only).
- `ApiError.js`, `isSessionExpired.js`: JSDoc-only differences; keep citadel's wording unless the
  sample adds information. `AuthSession.js`: keep `citadel_placeholder_refresh_token`.
- Specs (the sample has none here): `OrganizationsClientSpec.js` (paths, methods, bodies),
  `PermissionEventsSpec.js` (emit/subscribe/unsubscribe, no-`window` safety); extend
  `ApiClientSpec.js` (GET sends no body; `403` emits `permission:forbidden` before rejecting; other
  statuses don't), `AuthEventsSpec.js` (`userId` in detail, default `null`), `AuthStatusSpec.js`
  (`userId` forwarded when logged in; `null` when absent; not emitted on other branches). Existing
  `AuthEvents.emit(...)` callers in specs keep working thanks to the default.

## Files to Change

- `frontend/assets/js/client/OrganizationsClient.js` — new.
- `frontend/assets/js/client/PermissionEvents.js` — new.
- `frontend/assets/js/client/ApiClient.js` — no-body requests, 403 event.
- `frontend/assets/js/client/AuthEvents.js` — `userId`.
- `frontend/assets/js/client/AuthStatus.js` — forward `userId`.
- `frontend/assets/js/client/ApiError.js`, `frontend/assets/js/client/isSessionExpired.js` — JSDoc only, if any.
- `frontend/specs/assets/js/client/OrganizationsClientSpec.js` — new.
- `frontend/specs/assets/js/client/PermissionEventsSpec.js` — new.
- `frontend/specs/assets/js/client/ApiClientSpec.js` — extend.
- `frontend/specs/assets/js/client/AuthEventsSpec.js` — extend.
- `frontend/specs/assets/js/client/AuthStatusSpec.js` — extend.
