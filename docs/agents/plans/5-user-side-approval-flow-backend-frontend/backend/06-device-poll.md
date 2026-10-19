# Device-authorization poll

Per [api/auth.md → poll](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/api/auth.md#post-authauthorization-requestsuuidpolljson).

`auth/authorization-request.service.ts`, `#issueSessionFor` (reached only by the winning poll,
after `#claim`'s conditional `approved → logged`): after reloading the requester, if
`user.status !== UserStatus.APPROVED`, move the request `logged → denied` with a conditional
query-builder update (`set({ status: 'denied', resolvedAt: () => 'CURRENT_TIMESTAMP' })`,
`where uuid = :uuid AND status = 'logged'`) and return `{ status: 'denied' }` — no
`issueTokens`, no `authorization-request.logged` event. The controller already answers a
non-`approved` `PollResult` without a cookie; verify, no change expected.

`create` stays identical for every status (still saves and emits
`authorization-request.created`).

Tests (`authorization-request.service.poll.spec.ts`,
`authorization-request.controller.poll.e2e-spec.ts`,
`authorization-request.service.create.spec.ts`):

- Winning poll for a pending and for a denied requester → `{ status: 'denied' }`, no
  `issueTokens` call, no cookie, request row `denied`.
- Winning poll for an approved requester → unchanged.
- `create` for a pending, denied and approved username → identical response, a saved request and
  the event in all three cases.

## Files to Change

- `backend/src/auth/authorization-request.service.ts` — re-check in `#issueSessionFor`.
- `backend/src/auth/tests/authorization-request.service.poll.spec.ts` — unit cases.
- `backend/src/auth/tests/authorization-request.service.create.spec.ts` — status-independent create.
- `backend/src/auth/tests/authorization-request.controller.poll.e2e-spec.ts` — e2e cases.
