# Gate, config and errors

Write three small files.

`gate.md` (implemented by #4, extended by #5), from §3.2–3.4 and §6:

- Access-token payload `{ sub, sid, username, isAdmin }`; every path minting an access token
  (`TokenService#issueTokens`) sets `sid`.
- `SESSION_LOOKUP` port in `core/session-lookup.ts`, provided by the Auth module (Core never
  imports Auth); the single indexed query.
- `JwtGuard` (`backend/src/core/jwt.guard.ts`) order of checks; `request.user` built from the DB
  row — **`isAdmin` read fresh** (decided: a demoted admin loses access on the next request).
- Tokens without `sid` are **simply invalid** (decided: Citadel is a template, no transition).
- #5 adds `user.status = 'approved'` to the lookup.
- Side effect: logout / revoke / deny / demotion effective on the next request.
- Reference + Required tests (`jwt.guard.spec`, session service spec, session-gate e2e).

`config.md` (implemented by #5), from §4:

- `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`: exactly `true` → on; only decides the initial
  status of a new self-registration; never changes existing users, never disables the gate,
  never hides admin tools. `UserApprovalConfig` factory provider as its only reader.
- Note that #5 documents it in `environment-variables.md` and passes it through docker-compose.
- Reference + Required tests (config spec, register on/off).

`errors.md`, from §11 and §3.4:

- New `ErrorCodes`: `USER_DENIED` (403), `USER_NOT_PENDING` (422), `CANNOT_DENY_SELF` (422), with
  messages; where each is thrown.
- The identical `401` body for every gate rejection (invalid, expired, revoked, pending, denied),
  in Citadel's `http-exception.filter.ts` shape; DB errors stay `500`.
- New revoked reason `admin_denied`.
- Reference + Required tests (byte-for-byte `401` comparisons).

## Files to Change
- `docs/agents/specs/user-approval/gate.md` — new.
- `docs/agents/specs/user-approval/config.md` — new.
- `docs/agents/specs/user-approval/errors.md` — new.
