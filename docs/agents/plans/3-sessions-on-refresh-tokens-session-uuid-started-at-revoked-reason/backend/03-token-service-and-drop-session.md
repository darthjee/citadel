# TokenService sessions and drop the Session entity

Change `TokenService#issueTokens(user, session?)`:

- `session` is an optional `{ sessionUuid: string; startedAt: Date }` (export it as a
  `SessionIdentity` interface).
- Without it, start a new session with `randomUUID()` from `node:crypto` and `startedAt = new Date()`.
- With it, copy both values onto the new row.
- The new row is saved with `revokedAt: null` and `revokedReason: null`.

To support atomic rotation (step 04), let the row persistence take an optional `EntityManager`.
`issueTokens(user, session?, manager?)` then saves through `manager.getRepository(RefreshToken)`
when a manager is given, and through the injected repository otherwise.

Remove `auth_sessions` entirely:

- `#touchSession`, the `Repository<Session>` injection and its JSDoc mentions in `TokenService`;
- `backend/src/auth/entities/session.entity.ts` (delete the file);
- the `Session` entry in `AuthModule`'s `TypeOrmModule.forFeature`;
- `sessionRepo` and the `getRepositoryToken(Session)` override in `build-auth-test-app.ts`, plus its
  comment;
- the `auth_sessions` mentions in `AuthService`'s JSDoc.

Login, register (`AuthService`) and the device poll (`AuthorizationRequestService`) keep calling
`issueTokens(user)`, which now means a new session.

Tests (`token.service.spec.ts`):

- without a session, `sessionUuid` is a UUID and `startedAt` is about now;
- two calls give two different `sessionUuid`s;
- with a session, both values are copied;
- with a manager, the row is saved through it;
- no session repository remains.

Extend the e2e specs as well:

- login, register and a winning poll each persist a row with a fresh `sessionUuid`;
- two logins give two sessions.

## Files to Change

- `backend/src/auth/token.service.ts`: session parameter, optional manager, remove `#touchSession`.
- `backend/src/auth/entities/session.entity.ts`: delete.
- `backend/src/auth/auth.module.ts`: drop `Session` from `forFeature`.
- `backend/src/auth/auth.service.ts`: JSDoc mentions of `auth_sessions`.
- `backend/src/auth/tests/support/build-auth-test-app.ts`: drop `sessionRepo`.
- `backend/src/auth/tests/token.service.spec.ts`: new expectations; drop the session repo mock.
- `backend/src/auth/tests/auth.controller.login.e2e-spec.ts`, `auth.controller.register.e2e-spec.ts`, `authorization-request.controller.poll.e2e-spec.ts`: fresh-session assertions.
