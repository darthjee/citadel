# Context and permissions

Port the owner-context helpers, the remembered context and the permission matrix.

- `utils/context/ownerContext.js` as-is (`PERSONAL`, `organizationContext`, `parseOrgId` with
  `MAX_ORG_ID = 2147483647`, `contextPath`, `contextHash`, `landingFor`, `isSameContext`,
  `hashPath`, `splitOrgPrefix`, `stripContextPrefix`). Generic comments.
- `utils/context/ContextStorage.js`: key prefix `citadel_placeholder.context.` instead of
  `ward.context.`; keeps storing the organization id only, every access in `try`/`catch`, no clear
  on logout.
- `utils/context/entryResolution.js` as-is (`isEntryHash`, `resolveEntry`, `runEntryResolution`,
  `trackVisit`): applies the remembered context at the entry point only and forgets a stale id.
- `utils/permissions/orgPermissions.js`: `ACTIONS` keeps `WRITE` (`user`), `RENAME_ORGANIZATION`
  and `DELETE` (`admin`); drop `UNDO_PAYMENT`, `EDIT_PAYMENT_TRANSACTION`, `MANAGE_ACCOUNTS` from
  `ACTIONS` and `MIN_ROLE`. JSDoc: "mirrors the backend `@MinOrgRole` matrix".
- Specs: port `ownerContextSpec.js`, `ContextStorageSpec.js` (key `citadel_placeholder.context.<userId>`),
  `entryResolutionSpec.js`, `orgPermissionsSpec.js` (drop cases for the removed actions; keep
  fail-closed cases for `null`/unknown role and unknown action). Replace any bank paths in examples
  with a neutral path (e.g. `/widgets`).

## Files to Change

- `frontend/assets/js/utils/context/ownerContext.js` — new.
- `frontend/assets/js/utils/context/ContextStorage.js` — new, citadel key prefix.
- `frontend/assets/js/utils/context/entryResolution.js` — new.
- `frontend/assets/js/utils/permissions/orgPermissions.js` — new, trimmed actions.
- `frontend/specs/assets/js/utils/context/ownerContextSpec.js` — new.
- `frontend/specs/assets/js/utils/context/ContextStorageSpec.js` — new.
- `frontend/specs/assets/js/utils/context/entryResolutionSpec.js` — new.
- `frontend/specs/assets/js/utils/permissions/orgPermissionsSpec.js` — new.
