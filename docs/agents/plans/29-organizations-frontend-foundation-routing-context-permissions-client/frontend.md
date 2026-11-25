# Frontend Plan: Organizations: frontend foundation (routing, context, permissions, client)

Main plan: [plan.md](plan.md)

## Shared contracts

This agent **relies on** the backend's `status.json` answering `{ loggedIn: true, isAdmin, userId }`
for an approved user (no `userId` on any other branch), and on `GET /orgs.json` (#28) returning the
caller's organizations with their `role`.

It **produces** `AuthEvents.emit(loggedIn, isAdmin = false, pending = false, userId = null)`, with
event detail `{ loggedIn, isAdmin, pending, userId }`. `AuthStatus` forwards `userId ?? null` on the
logged-in branch only.

## Steps

- [01 — Routing](frontend/01-routing.md)
- [02 — Context and permissions](frontend/02-context-permissions.md)
- [03 — Client layer](frontend/03-client.md)
- [04 — Provider, hooks and controllers](frontend/04-provider-hooks-controllers.md)
- [05 — App wiring](frontend/05-app-wiring.md)
- [06 — Cleanup and docs](frontend/06-cleanup-docs.md)

## CI Checks

- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn test` (CI job: `jasmine`, runs `yarn coverage`)
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- **Move then adapt**: copy each sample file to the same path under `frontend/`, then adapt. Where
  the file already exists, merge the organization changes into citadel's version (citadel's
  wording/JSDoc may differ; keep citadel's when only wording differs, take the sample's behaviour).
  `Route.js`, `redirects.js`, `pickDefined.js`, `jsx-loader.mjs` and their specs are already
  identical: nothing to change, just delete the sample copies.
- Sample sources live under `docs/agents/specs/orgs/code_sample/frontend/`. Do **not** port the
  pages, `contextSwitcher/`, `Header.jsx`, `NotFound.jsx`, `PermissionDenied.jsx` or their specs —
  they belong to #30.
- ESLint `max-lines` is 300 (warn); keep new files and specs under it, splitting specs if needed.
- Specs run in Node without a DOM: follow the existing spec style (e.g. `useAuthEffectSpec.js`,
  `AuthSessionSpec.js`) for hooks, `window` events and `localStorage`.
- Security: API clients take the context as an argument, never from module-level state; `can()` fails
  closed; a malformed org id never triggers a request.
- Cache: no new endpoint is added by this agent; nothing changes in Navi.
