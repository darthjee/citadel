# Cache Plan: Admin review: approve and deny users (backend)

Main plan: [plan.md](plan.md)

## Shared contracts

- New routes `POST /admin/users/:id/approve.json` and `POST /admin/users/:id/deny.json`; changed
  `POST /admin/users/search.json` and `POST /admin/users/:id/edit.json`. All on `AdminController`,
  which carries `@CachePolicy(CacheClass.Never)` at controller level.

## Implementation Steps

### Step 1 — Verify the admin routes stay uncached

Read-only review once the backend steps land: confirm `AdminController` still carries
`@CachePolicy(CacheClass.Never)` at controller level (so the two new routes inherit it and send
`X-Skip-Cache`), and that `navi/resources/*.yml` warms none of the admin routes. Report any
violation to the backend agent; no Navi change expected.

## Files to Change

- None expected.
