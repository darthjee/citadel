# Non-disclosure tests

The cross-cutting checks from [security.md → Required tests](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/security.md#required-tests),
[errors.md → Required tests](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/errors.md#required-tests) and
[model.md → Required tests](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/model.md#required-tests) tagged #5 that are not already covered by
steps 01–06. Use `auth/tests/support/error-body.ts` to compare bodies ignoring `timestamp`.

- Byte-for-byte `401` on a protected route: pending user's and denied user's access token vs an
  expired token's.
- Byte-for-byte `status.json`: denied user vs anonymous (unknown token).
- The `user` payload of `login.json`, `register.json`, `refresh.json` and the winning poll has
  no `status` key, for every status (`serializeUser` already picks fields explicitly; this
  locks it in).
- `auth.controller.skip-cache.e2e-spec.ts`: `status.json` answers with `X-Skip-Cache` (today
  untested; its answer now depends on the user's status).
- Inserting a user without a status fails: covered by the migration spec (no default) and by the
  entity having no `default`.

Place them in a new `auth/tests/auth.controller.user-status.e2e-spec.ts` unless a case fits an
existing spec better.

## Files to Change

- `backend/src/auth/tests/auth.controller.user-status.e2e-spec.ts` — new.
- `backend/src/auth/tests/auth.controller.skip-cache.e2e-spec.ts` — `status.json` case.
