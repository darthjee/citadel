# Infra Plan: User-side approval flow (backend)

Main plan: [plan.md](plan.md)

## Shared contracts

- `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`: exactly `true` → on, anything else off; read only
  by `backend/src/auth/user-approval.config.ts`; sample value `false`.

## Implementation Steps

### Step 1 — Sample env and docs

- `.env.dev.sample`: add `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED=false` under
  "Backend framework settings", with a one-line comment (`true` holds new self-registrations for
  admin approval).
- `docs/agents/environment-variables.md`: a row in the **Consumed** table, optional:
  "`'true'` makes new self-registrations start `pending` until an admin approves them; anything
  else (default) starts them `approved`. Boot-time only; never changes existing users and never
  disables the `approved` requirement." Read by `backend/src/auth/user-approval.config.ts`,
  `backend/src/auth/auth.module.ts`.

### Step 2 — Container passthrough check

`docker-compose.yml` loads `.env` / `.env.prod` through `env_file` on `base` and `base_prod`,
so the variable reaches every backend service with no compose change. Confirm no backend service
uses an explicit `environment:` allowlist that would drop it, and check the CI config
(`.circleci/config.yml`) and any production / Render config for an explicit env list. Change
nothing unless such a list exists.

## Files to Change

- `.env.dev.sample` — new variable.
- `docs/agents/environment-variables.md` — new row.

## Notes

- Do not touch the Auth module docs or `product.md`: #7.
