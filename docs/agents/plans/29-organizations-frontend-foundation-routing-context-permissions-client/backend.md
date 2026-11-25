# Backend Plan: Organizations: frontend foundation (routing, context, permissions, client)

Main plan: [plan.md](plan.md)

## Shared contracts

This agent **produces** the new `userId` field: `status.json` answers
`{ loggedIn: true, isAdmin, userId }` for an approved user with an active session, where `userId` is
that user's own `User.id`. Every other branch (pending, anonymous, denied, unknown token) keeps its
current body **without** `userId`.

## Implementation Steps

### Step 1 — Add `userId` to the approved `status.json` answer

- `AuthStatus` interface: add an optional `userId?: number`.
- `#statusFor`: the `APPROVED` branch returns `{ loggedIn: true, isAdmin: user.isAdmin, userId: user.id }`.
  Leave `anonymous()` and the pending branch unchanged (key order and shape of the logged-out
  answers stay identical, which the existing anti-enumeration specs rely on).
- Update the specs that assert the approved body exactly (`toEqual`) to include `userId`, and add
  an assertion that the pending and anonymous answers carry no `userId`.

### Step 2 — Document the field

- `docs/agents/backend/routes/auth.md` (`POST /auth/status.json`): success response becomes
  `{ loggedIn, isAdmin, userId }` for an approved user; update the cases table and note that the id
  is the caller's own (used by the frontend to key the remembered organization context).
- `docs/agents/modules/auth.md` if it repeats the status body.

## Files to Change

- `backend/src/auth/session-status.service.ts` — `AuthStatus.userId`, approved branch.
- `backend/src/auth/tests/session-status.service.spec.ts` — approved body with `userId`; no `userId` elsewhere.
- `backend/src/auth/tests/auth.controller.spec.ts` — approved body with `userId` where asserted.
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts` — approved body with `userId` where asserted.
- `docs/agents/backend/routes/auth.md` — status endpoint contract.
- `docs/agents/modules/auth.md` — only if it repeats the status body.

## CI Checks

- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI job: `backend_checks`)

## Notes

- Data-access: the field is the requesting user's own id, already known to them (it is in the
  login/register `user` payload), so no new data is exposed.
- Cache: `status.json` is already a never-cached auth route; no policy change.
