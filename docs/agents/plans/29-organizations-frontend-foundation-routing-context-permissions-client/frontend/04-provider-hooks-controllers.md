# Provider, hooks and controllers

Port `components/common/ownerContext/` as-is, with generic comments.

- `OwnerContextProvider.jsx` (`buildOwnerContextValue`, `resolveRole`; props `route`, `children`):
  loads the org list through `OrgListController`, runs `runEntryResolution` once the session's list
  is loaded, tracks visits, refreshes on `403` through `forbiddenRefreshEffect`. `role` is `owner`
  in personal, the listed org's role otherwise, `null` while loading or when not listed;
  `refreshRole` is the list refetch.
- `hooks/useOwnerContext.js` (the React context + hook) and `hooks/useCan.js` (`useCan(action)`
  → `can(role, action)` for the active context).
- `controllers/OrgListController.js` (`EMPTY_ORG_STATE`, `buildOrgListEffect`; loads `GET /orgs.json`
  once per session on `AuthEvents` login, clears on logout, keeps `userId` from the event) and
  `controllers/forbiddenRefreshEffect.js` (one refresh per burst of `403`s, via an in-flight flag).
- Specs (the sample has none): `OwnerContextProviderSpec.js` (`buildOwnerContextValue` role cases:
  personal → `owner`, listed org → its role, unlisted/loading → `null`; `refreshRole === refreshOrgs`),
  `useOwnerContextSpec.js`, `useCanSpec.js`, `OrgListControllerSpec.js` (login loads once, repeated
  login events don't reload, logout clears, error state, `refresh()` refetches, `userId` recorded,
  `onSessionLoaded` called), `forbiddenRefreshEffectSpec.js` (a burst triggers one refresh; a new
  `403` after completion triggers another; cleanup unsubscribes). Follow the existing hook/controller
  spec style (no DOM; stub `OrganizationsClient` and the event buses).

## Files to Change

- `frontend/assets/js/components/common/ownerContext/OwnerContextProvider.jsx` — new.
- `frontend/assets/js/components/common/ownerContext/hooks/useOwnerContext.js` — new.
- `frontend/assets/js/components/common/ownerContext/hooks/useCan.js` — new.
- `frontend/assets/js/components/common/ownerContext/controllers/OrgListController.js` — new.
- `frontend/assets/js/components/common/ownerContext/controllers/forbiddenRefreshEffect.js` — new.
- `frontend/specs/assets/js/components/common/ownerContext/OwnerContextProviderSpec.js` — new.
- `frontend/specs/assets/js/components/common/ownerContext/hooks/useOwnerContextSpec.js` — new.
- `frontend/specs/assets/js/components/common/ownerContext/hooks/useCanSpec.js` — new.
- `frontend/specs/assets/js/components/common/ownerContext/controllers/OrgListControllerSpec.js` — new.
- `frontend/specs/assets/js/components/common/ownerContext/controllers/forbiddenRefreshEffectSpec.js` — new.
