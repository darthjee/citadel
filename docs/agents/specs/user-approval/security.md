# Security

Back to the [feature README](README.md).

Rules implemented across #4–#6; most land in #5 (non-disclosure, refresh / poll re-checks)
and #6 (approve / deny races).

## Non-disclosure

- A **denied** account looks like a logged-out or unknown one everywhere, except login **after a
  correct password** (`403 USER_DENIED`). A wrong password keeps the `401`, so the status cannot
  be probed without the password.
- `status.json` reveals only `pending`, and only to the holder of that user's own valid session.
  A denied user's `status.json` is byte-for-byte the anonymous answer.
- Password recovery gives the same response and the same caller-visible side effects for every
  status: `recover.json` always answers `200 { sent: true }`, and a denied user's reset token
  fails with the same `400` as an unknown one, checked before any password hashing.
  **Response time is not equalised** for `recover.json`: the approved/pending path does a token
  insert and fires an event that the unknown/denied path skips. That gap already exists today
  between known and unknown emails; this feature puts denied on the unknown side and adds no new
  one. Equalising it is out of scope.
- On business endpoints, pending and denied users get the same `401` body as an invalid or expired
  token ([errors.md](errors.md#the-identical-401)).
- The device-authorization poll answers a non-approved requester with the same
  `{ "status": "denied" }` as a request the approver denied.
- The auth endpoints' `user` payload never carries `status`; only admins see it.
- Registering with a denied account's username or email gets the existing `409`: it reveals that
  the value is taken, which registration already reveals for any account, and nothing about the
  status.

## Races

1. **Approve vs deny on the same user.** Approve is a conditional update
   (`UPDATE … SET status = 'approved' WHERE id = ? AND status = 'pending'`), so it never
   overwrites a deny. Whichever lands second: a late approve gets `422 USER_NOT_PENDING`; a late
   deny succeeds (deny is lenient) and wins.
2. **A rotation or winning device poll racing deny's bulk revoke.** Either can insert a new
   active refresh-token row right after deny revoked every active one. Three layers close it:
   - `refresh.json` re-checks the user and, if `denied`, revokes the presented token with
     `admin_denied` and answers `401` ([api/auth.md](api/auth.md#post-authrefreshjson));
   - the poll re-checks the requester right before minting and moves the request
     `logged → denied` ([api/auth.md](api/auth.md#post-authauthorization-requestsuuidpolljson));
   - the gate requires `approved` regardless, so any access token from such a row gets `401`
     ([gate.md](gate.md)).
3. **Concurrent refreshes of one token / logout with a stale token.** Rotation is a single-winner
   conditional revoke in one transaction with the insert, and logout revokes the whole session
   ([model.md](model.md#sessions-on-refresh-tokens)), so a session can never fork into two active
   chains that outlive a logout or a deny.
4. **Deny's two writes.** The status update and the bulk revoke are separate writes. If the
   revoke fails after the status update, the gate still answers `401` (it requires `approved`),
   and the `refresh.json` / `status.json` re-checks revoke leftovers; a retried deny revokes the
   rest.
5. **Deny on an already denied user.** Allowed (`200`); it still revokes any active token, which
   cleans up a row left by races 2 or 4.
6. **Approval while the user has several tabs open.** No race: the session is untouched, every
   tab re-checks `status.json` on window focus ([ui/user.md](ui/user.md)).

## Accepted risks and costs

- **One admin can deny every other admin.** Admins can deny admins; only self-deny is refused.
  There is no un-deny through the application: recovering from a rogue admin needs a DB change.
- **One DB lookup per authenticated request.** The gate runs a single indexed query on
  `auth_refresh_tokens.session_uuid` (joined to `auth_users` by primary key) on every
  non-`@Public()` request. Accepted (decided) as the price of immediate revocation.
- **Denied accounts keep their username and email** (the row is never deleted).
- **The flag is boot-time only.** Changing it needs a restart; it never affects existing users.

## Reference

- [user-approval.md → Non-disclosure](https://github.com/darthjee/kerghan/blob/main/docs/agents/modules/auth/user-approval.md#non-disclosure)
- [admin.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/admin.service.ts)
- [auth.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/auth.service.ts)
- [authorization-request.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/authorization-request.service.ts)

## Required tests

- Byte-for-byte comparison (ignoring `timestamp`) of: a pending and a denied user's business
  `401` vs an expired token's; a denied user's `status.json` vs the anonymous answer.
- `login.json` on a denied user with a wrong password → the same `401` as an unknown user.
- `recover.json` for denied vs unknown vs approved email → identical response; no token or event
  for denied.
- Approve after a deny (conditional update not matching) → `422`, status stays `denied`.
- Deny after an approve → `200`, status `denied`.
- A refresh token minted after a deny (simulating the race) → `refresh.json` answers `401` and
  revokes it with `admin_denied`; its access token gets the gate's `401`.
- A winning poll for a requester denied between approve and poll → `{ status: 'denied' }`, no
  session.
- Deny on a denied user with a leftover active token → token revoked.
- Concurrent refreshes of one token → one winner, one `401`, one active row in the session.
- `reset-password.json` with a denied user's valid token never calls `bcrypt.hash` (same fast
  path as an unknown token).
