# Frontend Plan: Organizations: frontend pages and context switcher

Main plan: [plan.md](plan.md)

## Overview

This plan ports the remaining frontend part of the organizations sample:

- the three organization pages, with their controllers and helpers;
- the context switcher;
- `NotFound` and `PermissionDenied`.

It also adds the organization routes and takes from ward the pieces the sample omits. Then it deletes
`code_sample/frontend/` and folds the docs into the permanent pages.

## Context

- #29 (merged) provides:
  - routing (`HashRouteResolver.resolve()` → `{ page, context }`; `routes.js` tables still empty);
  - `ownerContext`, `ContextStorage`, `entryResolution` and `orgPermissions`;
  - `OrganizationsClient` (`list`, `create`, `show`, `rename`);
  - `OwnerContextProvider`, `useOwnerContext` and `useCan`;
  - `App.jsx`, which mounts `<OwnerContextProvider route={route}>` around `AppHelper.render(route.page)`.
- Ward, the original project, is at `~/projetos/mine/ward/frontend`. Port from it wherever the sample
  is missing a file or spec. **Stay close to the original**: copy the file, then adapt it. The
  adaptations are:
  - replace import paths to citadel equivalents;
  - drop bank-only pieces (`BankMenu`, bank page keys and bank assertions);
  - drop ward's right-aligned `ms-auto` account `Nav`, since citadel keeps its current link layout;
  - turn ward/bank mentions in comments into generic text.
- Every file this issue adds or changes gets a spec. Use ward's spec when it exists; otherwise write a
  new one.

## Steps

- [01 — Shared views, name validator and routes](frontend/01-shared-validator-routes.md)
- [02 — Organization pages](frontend/02-organization-pages.md)
- [03 — Context switcher and header](frontend/03-context-switcher.md)
- [04 — App wiring: page keys and context remount](frontend/04-app-wiring.md)
- [05 — Cleanup and docs](frontend/05-cleanup-docs.md)

## CI Checks

- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn test` (CI job: `jasmine`, which runs
  `yarn coverage`)
- `frontend`: `docker-compose run --rm citadel_placeholder_fe yarn lint` (CI job: `frontend-checks`)

Never run `yarn` on the host. Always go through `docker-compose`.

## Notes

- **Cache, data-access and security:** no new endpoint, response field or auth logic. The pages only
  consume `/orgs` routes that #28 already reviewed. The UI gating (`can()`) is UX only, because the
  backend enforces it. The single Not-found view never reveals whether an organization exists.
- ESLint `max-lines` is 300 (warn). Keep spec files under it, splitting with shared examples in
  `specs/support/` if needed.
- Specs run in Node with no DOM. Use the existing helpers (`renderedOutput`,
  `renderCapturingHandlers`, `fakeWindow`, `flushMicrotasks`, `sessionExpiredError`).
- `ROUTES_CONTEXT` and `SECTIONS_CONTEXT` stay empty; #31 fills them.
