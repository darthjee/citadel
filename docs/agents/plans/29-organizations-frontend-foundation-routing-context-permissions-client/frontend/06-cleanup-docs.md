# Cleanup and docs

- Delete every sample file ported or reconciled here from `docs/agents/specs/orgs/code_sample/frontend/`:
  `client/` (all 9 files), `utils/` (all routing, context and permissions files),
  `components/common/ownerContext/` (5 files), and the specs for routing, context, permissions and
  `specs/support/jsx-loader.mjs`. Keep the #30 files: `components/resources/organizations/`,
  `components/common/header/`, `notFound/`, `PermissionDenied.jsx` and their specs.
- `docs/agents/specs/orgs/code-sample-frontend.md` and `code-sample.md`: mark sections 1–5 (and the
  ported specs) as moved into the codebase, with the real paths, and update counts so the doc lists
  only what remains for #30.
- `docs/agents/modules/auth/organizations.md`: add a **Frontend** section — route tables and the
  resolver lookup order (malformed id → `not-found`, no request); `contextPath`/`contextHash` and
  "API clients take the context as an argument"; the remembered context
  (`citadel_placeholder.context.<userId>`, org id only, stale id forgotten at entry); `can()`
  failing closed and the action list; the provider (`role`, `refreshRole`, one org-list load per
  session) and the role refresh on `403`.
- `docs/agents/architecture/frontend.md`: directory layout (`utils/context/`, `utils/permissions/`,
  `components/common/ownerContext/`), routing now returns `{ page, context }`, and a pointer to
  `organizations.md`.

## Files to Change

- `docs/agents/specs/orgs/code_sample/frontend/...` — delete ported files.
- `docs/agents/specs/orgs/code-sample-frontend.md` — update.
- `docs/agents/specs/orgs/code-sample.md` — update.
- `docs/agents/modules/auth/organizations.md` — frontend section.
- `docs/agents/architecture/frontend.md` — layout and routing.
