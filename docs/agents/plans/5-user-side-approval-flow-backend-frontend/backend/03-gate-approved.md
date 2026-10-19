# Gate requires `approved`

Per [gate.md → The gate requires `approved`](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/gate.md#the-gate-requires-approved). The only gate
change: business endpoints never read the status themselves.

- `auth/session.service.ts`: `findActiveSessionUser` adds
  `.andWhere('user.status = :status', { status: UserStatus.APPROVED })`; update its doc comment.
- `auth/tests/support/in-memory-session-lookup.ts`: the same rule (`user.status === 'approved'`).
- `JwtGuard` is unchanged.

Tests:

- `session.service.spec.ts`: the query builder receives the `status` condition with
  `approved`; a `null` result maps to `null`.
- `auth.controller.session-gate.e2e-spec.ts`: a pending user's access token gets the identical
  `401`; after setting the row to `approved` the **same** token passes; a denied user's token
  gets the identical `401`. A pending approver calling `authorize.json` → the gate's `401`.

## Files to Change

- `backend/src/auth/session.service.ts` — `approved` condition.
- `backend/src/auth/tests/support/in-memory-session-lookup.ts` — same rule.
- `backend/src/auth/tests/session.service.spec.ts` — query shape.
- `backend/src/auth/tests/auth.controller.session-gate.e2e-spec.ts` — pending / denied / approval.
