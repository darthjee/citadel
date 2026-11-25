# Backend Plan: Organizations: core groundwork (strict body pipe, parse-id)

Main plan: [plan.md](plan.md)

## Overview
Bring over two non-organization-specific core helpers the later organizations sub-issues (#27, #28) rely
on, staying identical to the original code in `docs/agents/specs/orgs/code_sample/backend/src/core/` (apart from citadel adaptations, if any are needed),
and clear the no-port sample copies out of `docs/agents/specs/orgs/code_sample/`.

## Context
- Citadel's global pipe (`backend/src/main.ts`: `new ValidationPipe({ whitelist: true, transform: true })`)
  **strips** unknown fields. `@StrictBody()` **rejects** them (400), and is bound only to its own parameters via
  `validateCustomDecorators`; the global pipe skips custom-decorator params, so there is no double validation.
- `HttpExceptionFilter` (`core/http-exception.filter.ts`) already maps an array-`message` 400 to
  `VALIDATION_FAILED` with `details`, and a bare `NotFoundException` to `NOT_FOUND`. No filter change.
- Primary keys are signed `int` (`idColumn()` in `database/migrations/helpers.ts`), matching
  `MAX_ID = 2147483647`.
- **Must not** apply `@StrictBody()` to any existing route (register/reset-password rely on stripping
  `password_confirmation`), nor touch `main.ts`'s global pipe.
- **Must not** port `cache-invalidation.*` (→ #27) or the `X-Cache-Allow` changes in `cache-class.ts` /
  `cache-policy.interceptor.ts` (→ #33); leave those sample files in place.

## Steps

- [01 — Port parseId](backend/01-port-parse-id.md)
- [02 — Port StrictValidationPipe / @StrictBody() with edge-case specs](backend/02-port-strict-body.md)
- [03 — Delete no-port sample copies](backend/03-delete-no-port-samples.md)
- [04 — Document the helpers](backend/04-docs.md)

## CI Checks
- `backend/`: `docker-compose run --rm citadel_placeholder_tests yarn coverage` (CI job: `backend_tests`)
- `backend/`: `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Always run yarn through docker-compose, never on the host.
- No integration (MySQL) spec: nothing touches the database.
- Suggested: a light read-only `security` agent review of the pipe (input handling).
- Nested-field behaviour of `forbidNonWhitelisted` must be *pinned* by a spec, not changed: only nested objects
  marked `@ValidateNested()` + `@Type()` are checked.
