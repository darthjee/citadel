# Transaction, race and join specs

Real-engine checks for the Auth module's transactional and query-builder code. Each file resets
the DB and runs all migrations in `beforeAll`/`beforeEach`, and builds the service under test with
the real `Repository`s from the test `DataSource` (other collaborators as in the existing unit
specs, e.g. a real `JwtService` with a test secret / the same config doubles `token.service.spec.ts`
uses).

- `src/auth/tests/integration/token-rotation.integration-spec.ts` (`TokenService#rotateTokens`):
  - **race:** seed one user + one active refresh-token row; call `rotateTokens(user, presented)`
    twice with `Promise.allSettled` (repeat several times with fresh rows): exactly one fulfilled,
    one rejected with `UnauthorizedException`; afterwards exactly one active (unrevoked) row for
    that `session_uuid`, the presented row is revoked with `rotated`, and the total row count grew
    by exactly one (the loser's replacement was rolled back).
  - **rollback on failure:** make the transaction fail after the replacement insert (e.g. the
    presented row already revoked before the call, so the conditional update affects 0 rows) →
    rejects, no replacement row remains, the presented row keeps its earlier state.
- `src/auth/tests/integration/session.service.integration-spec.ts`
  (`SessionService#findActiveSessionUser`): seed users and refresh-token rows; returns
  `{ id, username, isAdmin }` for an active session of an `approved` user (fresh `isAdmin` from the
  row); `null` for a revoked session, an expired session, an unknown `sid`, a `pending` user and a
  `denied` user.

## Files to Change

- `backend/src/auth/tests/integration/token-rotation.integration-spec.ts` — new.
- `backend/src/auth/tests/integration/session.service.integration-spec.ts` — new.
