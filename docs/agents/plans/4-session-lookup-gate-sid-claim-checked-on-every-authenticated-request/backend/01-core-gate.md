# Core: sid claim, SESSION_LOOKUP port and the gate in JwtGuard

Add the `sid` claim to the payload type, the Core-owned lookup port, and the session check in
`JwtGuard`, mirroring Kerghan's
[jwt.guard.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/jwt.guard.ts) and
[session-lookup.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/session-lookup.ts).

## Payload

`core/access-token-payload.ts`: add `sid: string` (`{ sub, sid, username, isAdmin }`); update its
doc comment (signed by `TokenService#issueTokens`; `username`/`isAdmin` are informational for the
frontend, the backend reads them from the DB). `types/express.d.ts` keeps typing `request.user` as
`AccessTokenPayload`.

## Port

New `core/session-lookup.ts`:

```ts
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');

export interface SessionUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

export interface SessionLookup {
  findActiveSessionUser(sid: string): Promise<SessionUser | null>;
}
```

## Guard

`core/jwt.guard.ts`:

- Constructor gains `@Inject(SESSION_LOOKUP) sessionLookup: SessionLookup`.
- `canActivate` becomes `async` and returns `Promise<boolean>`:
  1. `@Public()` → `true` (lookup never called).
  2. Missing cookie → `UnauthorizedException('Missing access token')` (unchanged).
  3. Signature/expiry against the current key, then previous keys (unchanged).
  4. `#validateClaims`: `sid` must be a string matching a UUID pattern (a module-level
     `UUID_PATTERN` regex, case-insensitive, 8-4-4-4-12 hex) and `sub` must satisfy
     `Number.isInteger`.
  5. `await this.sessionLookup.findActiveSessionUser(sid)`; `null` or `user.id !== sub` → invalid.
  6. `request.user = { sub, sid, username: user.username, isAdmin: user.isAdmin }`.
- Every rejection in 3–5 throws the same `UnauthorizedException('Invalid or expired access token')`
  (one `#invalidToken()` helper / shared message constant). Lookup errors are not caught
  (propagate as `500`).
- Verified payloads are typed as a loose `VerifiedPayload` (claims unknown until validated)
  rather than trusting `AccessTokenPayload`.
- Update the class doc comment: the session gate, `request.user` from the DB row.

`AppModule` `APP_GUARD` order is unchanged (`OriginGuard`, `JwtGuard`, `AdminGuard`).

## Unit tests

`core/tests/jwt.guard.spec.ts`: `buildGuard` takes a lookup double (a `jest.fn()`
`findActiveSessionUser`); `PAYLOAD` gains a valid `sid`; `run` awaits `canActivate`. Cover:

- active session of the same user passes; `request.user` comes from the lookup row (token claims
  `isAdmin: true`, row `isAdmin: false` → `false`; row `username` wins);
- identical `401` (`toThrow(INVALID)`) for: no `sid`; non-UUID `sid`; non-string `sid`;
  non-integer `sub` (string, float); lookup `null`; lookup user with `id !== sub` (another user's
  session); bad signature; expired token; the existing `alg: none` / empty-secret cases;
- lookup rejecting propagates the same error (not a `401`);
- `@Public()` and missing cookie never call the lookup;
- a token signed with a previous key still goes through the lookup, and fails when it returns
  `null`.

## Files to Change
- `backend/src/core/access-token-payload.ts` — add `sid`.
- `backend/src/core/session-lookup.ts` — new port.
- `backend/src/core/jwt.guard.ts` — async gate.
- `backend/src/core/tests/jwt.guard.spec.ts` — lookup double and new cases.
