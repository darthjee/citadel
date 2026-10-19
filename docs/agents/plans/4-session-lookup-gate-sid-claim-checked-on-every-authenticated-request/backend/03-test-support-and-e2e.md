# Test support and session-gate e2e

Make the e2e harnesses run the gate, then cover its end-to-end effects.

## In-memory lookup

New `auth/tests/support/in-memory-session-lookup.ts`, `InMemorySessionLookup implements
SessionLookup`, constructed with the live `userRepo.rows` and `refreshTokenRows` arrays: finds the
row with `sessionUuid === sid`, `!revokedAt`, `expiresAt > now`, then the user with
`id === row.userId`; returns `{ id, username, isAdmin }` or `null`. No status rule yet (#5 adds
it). Comment why it exists (the real join cannot run on per-entity in-memory repos; the real query
is covered by `session.service.spec.ts`). Reference
[in-memory-session-lookup.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/support/in-memory-session-lookup.ts).

## Harness wiring

- `auth/tests/support/build-auth-test-app.ts`: `.overrideProvider(SESSION_LOOKUP).useValue(new
  InMemorySessionLookup(userRepo.rows, refreshTokenRepo.rows))`; extend the header comment.
- `core/tests/request-logging.e2e-spec.ts`: add `{ provide: SESSION_LOOKUP, useValue: { findActiveSessionUser: async () => null } }`
  (or equivalent) to `TestAppModule` providers. Its protected-route cases use no / invalid tokens,
  so behaviour is unchanged.
- Any existing spec that hand-signs an access token for a protected route must sign a `sid` of an
  active session row (or log in for real). Run the full suite to find them.

## Session-gate e2e

New `auth/tests/auth.controller.session-gate.e2e-spec.ts` (mirroring Kerghan's
[auth.controller.session-gate.e2e-spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/auth.controller.session-gate.e2e-spec.ts)),
using the existing support (`useTestApp` / `buildAuthTestApp`, `loginAs` / `loginCookie`,
`expectErrorBody`) and the `/protected` throwaway route:

- after `DELETE /auth/logoff.json`, the same access token gets the `401 Invalid or expired access
  token` body on `/protected`;
- two logins of the same user: logging one out leaves the other's access token working;
- after a password reset (`reset-password.json`), a previously issued access token gets `401`;
- a session whose refresh-token row expired (set `expiresAt` in the past on the in-memory row)
  gets `401`;
- an admin demoted by flipping `isAdmin` on the in-memory user row gets `403` on the next
  `@AdminOnly()` call (`adminGuard: true`, an admin route of `AdminController`);
- `refresh.json` returns an access token whose decoded `sid` equals the session's `session_uuid`
  (the same as the login token's `sid`), and that new token passes the gate.

## Files to Change
- `backend/src/auth/tests/support/in-memory-session-lookup.ts` — new.
- `backend/src/auth/tests/support/build-auth-test-app.ts` — override `SESSION_LOOKUP`.
- `backend/src/core/tests/request-logging.e2e-spec.ts` — stub provider.
- `backend/src/auth/tests/auth.controller.session-gate.e2e-spec.ts` — new.
- Existing specs that hand-sign access tokens — add a valid `sid` (as found by the suite).
