# Cache Plan: User-side approval flow (backend)

Main plan: [plan.md](plan.md)

## Shared contracts

- No new route. Changed routes: `POST /auth/login.json`, `register.json`, `status.json`,
  `refresh.json`, `recover.json`, `reset-password.json` and
  `POST /auth/authorization-requests/:uuid/poll.json`, all on controllers carrying
  `@CachePolicy(CacheClass.Never)`.

## Implementation Steps

### Step 1 — Verify the auth endpoints stay uncached

Read-only review once the backend steps land: confirm `AuthController` and
`AuthorizationRequestController` still carry `@CachePolicy(CacheClass.Never)`, that
`status.json` (whose answer now depends on the user's status) sends `X-Skip-Cache` — the backend
adds that assertion to `auth.controller.skip-cache.e2e-spec.ts` in its step 07 — and that `navi/resources/*.yml` warms none of these routes. Report any
violation to the backend agent; no Navi change expected.

## Files to Change

- None expected.
