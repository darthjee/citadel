# Auth: SessionService, module wiring and sid signing

Implement the port inside the Auth module and make every minted access token carry `sid`.

## SessionService

New `auth/session.service.ts`, `@Injectable() SessionService implements SessionLookup`, with
**only** `findActiveSessionUser` (Citadel has no session list/revoke endpoints; do not port
Kerghan's `listActive` / `revoke` / `revokeOthers`). Inject only `@InjectRepository(User)`.

```ts
const user = await this.userRepository
  .createQueryBuilder('user')
  .innerJoin(RefreshToken, 'session', 'session.userId = user.id')
  .select(['user.id', 'user.username', 'user.isAdmin'])
  .where('session.sessionUuid = :sid', { sid })
  .andWhere('session.revokedAt IS NULL')
  .andWhere('session.expiresAt > :now', { now: new Date() })
  .getOne();

return user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null;
```

Doc comment: one indexed query on `session_uuid`; in-module join (both `auth_` tables); DB errors
propagate; #5 adds the `approved` condition. Reference
[session.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/session.service.ts).

## Module wiring

`auth/auth.module.ts`: add `SessionService` and `{ provide: SESSION_LOOKUP, useExisting:
SessionService }` to `providers`; `exports: [AuthService, SESSION_LOOKUP]` (never `SessionService`
itself). Update the module doc comment.

## sid signing

`auth/token.service.ts` `issueTokens`: resolve `{ sessionUuid, startedAt }` **before** signing and
sign `{ sub: user.id, sid: sessionUuid, username: user.username, isAdmin: user.isAdmin }`. Login,
register, refresh (`rotateTokens` passes the presented session) and the winning device poll all
go through it. Update the JSDoc (`{ sub, sid, username, isAdmin }`).

## Unit tests

- New `auth/tests/session.service.spec.ts` (mocked query builder, as Kerghan's
  [session.service.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/session.service.spec.ts)):
  joins `RefreshToken` on `session.userId = user.id`; filters by `sid`, `revokedAt IS NULL`,
  `expiresAt > now`; selects only `id`/`username`/`isAdmin`; maps the row to a `SessionUser`;
  returns `null` when `getOne` resolves `null`; a rejected `getOne` propagates.
- `auth/tests/token.service.spec.ts`: the access token decodes to a `sid` equal to the saved row's
  `sessionUuid`, for a new session and for a continued one.

## Files to Change
- `backend/src/auth/session.service.ts` — new.
- `backend/src/auth/auth.module.ts` — provide and export `SESSION_LOOKUP`.
- `backend/src/auth/token.service.ts` — sign `sid`.
- `backend/src/auth/tests/session.service.spec.ts` — new.
- `backend/src/auth/tests/token.service.spec.ts` — `sid` assertions.
