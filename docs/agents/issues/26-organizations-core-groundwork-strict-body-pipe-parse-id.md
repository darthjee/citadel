# Issue: Organizations: core groundwork (strict body pipe, parse-id)

## Description

Part of epic #25 (Organizations: optional org ownership for domain data). Citadel is a project template;
organizations ship with it so derived projects can have domain data owned by an organization instead of a
single user. The target behaviour is specified in `docs/agents/specs/orgs/` (hub: `README.md`), and the
original implementation is mirrored under `docs/agents/specs/orgs/code_sample/` with the same paths as the
real codebase.

This first sub-issue brings over the **non-organization-specific core groundwork** the later sub-issues rely
on (`@StrictBody()` and `parseId`), and clears out the sample copies of core files that turned out to need no
port.

**Approach (applies to every sub-issue of #25):** move files from `code_sample/` into their real location, then
adapt them to citadel, staying close to the original so fixes can flow between citadel and its derived projects.
Remove each `code_sample/` file once moved/reconciled, and fold what matters from the spec pages into the
permanent docs.

## Problem

- The organization and owner-scoped handlers (#27, #28) need two core helpers citadel does not have:
  - a body validator that **rejects** unknown fields (so a client can never smuggle `organizationId`, `role`,
    etc.), whereas citadel's global `ValidationPipe` (`main.ts`, `whitelist: true`) silently strips them;
  - a strict id parser that answers the **uniform 404** (never a 400 like `ParseIntPipe`), so a malformed id is
    indistinguishable from an unknown one.
- `code_sample/` holds ~19 copies of core files that already exist in citadel and carry nothing to port (identical,
  or differing only by env var prefix `WARD_*` vs `CITADEL_PLACEHOLDER_*`, or by `bank`-only error codes). They
  are noise for every later sub-issue until removed.

## Expected Behavior

- `@StrictBody()` (from `StrictValidationPipe`: `whitelist` + `forbidNonWhitelisted` + `transform` +
  `validateCustomDecorators`) validates a handler's body against its DTO and answers **400** for unknown fields,
  invalid fields, a missing/empty body or a non-object JSON body. The error goes through citadel's existing
  `HttpExceptionFilter` as `VALIDATION_FAILED` with `details` (e.g. `property organizationId should not exist`).
  The body is validated once: the global pipe skips custom-decorator parameters.
- `parseId(raw)` returns the id for strings matching `^[1-9][0-9]*$` up to `MAX_ID = 2147483647` (citadel's signed
  `int` primary keys) and throws `ownerNotFound()` (a uniform `NotFoundException`) for anything else.
- **No behaviour change on any existing route.** The global pipe is unchanged (still strips), `@StrictBody()` is
  not applied to existing auth/admin/authorization-request routes (register and reset-password rely on stripping
  `password_confirmation`), and `parseId` has no existing callers.
- The no-port sample copies are gone from `code_sample/`.

## Solution

### Port (from `code_sample/backend/src/core/`, with their specs)

- `strict-validation.pipe.ts`: `StrictValidationPipe`, `getRequestBody`, `@StrictBody()`
- `parse-id.ts`: `MAX_ID`, `ownerNotFound()`, `parseId()`
- `tests/strict-validation.pipe.spec.ts`, `tests/parse-id.spec.ts`

### Delete from `code_sample/` (no port needed)

- identical: `admin.guard`, `admin-only.decorator`, `boolean-metadata`, `access-token-payload`,
  `current-user.decorator`, `public.decorator`, `session-lookup`, `cache-policy.decorator`,
  `database/migrations/helpers.ts`, and specs `admin.guard`, `current-user.decorator`, `http-exception.filter`;
- env-prefix-only differences: `jwt.guard`, `cache-token.service`, `secret-keys`, and specs `app.module`,
  `jwt.guard`, `cache-token.service`;
- `error-codes.ts`: only `bank` codes differ; not ported. Org-specific codes, if any, come with #27.

### Left in `code_sample/` for other issues

- `cache-invalidation.decorator.ts` / `.interceptor.ts` and the decorator spec → **#27**: the interceptor's `owner`
  mode reads `request.ownerContext`, introduced there, and `@OwnerScopedController()` is its first user.
- `cache-class.ts` / `cache-policy.interceptor.ts` (the `X-Cache-Allow` per-caller cache model) → **#33**
  (citadel-wide per-user cache with Tent/proxy work). `user-scoped` keeps sending `X-Skip-Cache` meanwhile.

### Testing

- Port and adapt the two specs above.
- Add `@StrictBody()` cases the sample lacks:
  1. missing or empty body → 400 (never 500 or pass-through);
  2. non-object JSON body (array, string, number) → 400;
  3. nested unknown fields: pin down the behaviour (`forbidNonWhitelisted` only reaches nested objects marked
     `@ValidateNested()` + `@Type()`) and document it next to the pipe;
  4. one case through citadel's real `HttpExceptionFilter`, asserting the final `VALIDATION_FAILED` body;
  5. the body is validated once (the global pipe skips it).
- No MySQL integration test (no DB involvement). Full backend suite and lint stay green.

### Docs

- Document `@StrictBody()` (when to use it vs `@Body()`, the nested-field caveat) and `parseId` (uniform 404,
  `MAX_ID` tied to `int` ids: a derived project moving to `bigint` must raise it) in
  `docs/agents/architecture/backend.md`.

### Performance & security

- `parseId`'s anchored regex is linear (no ReDoS); the 404 never reveals whether an id exists.
- The strict 400 echoes caller-sent field names only; body size stays bounded by Express's JSON limit; field
  enumeration by elimination is accepted. The filter never logs client-error bodies.
- `StrictValidationPipe` is built once at decoration time; no double validation.
- A light **security** agent review is suggested during planning (input-handling change).

### Out of scope

Owner context and org roles (#27), cache invalidation (#27), organization entities/routes (#28), frontend,
per-caller cache and proxy work (#33), hardening existing routes with `@StrictBody()`.

### Agents

backend (implementation); security (light review).

## Benefits

- #27 and #28 can use `@StrictBody()` and `parseId` exactly as in the original code.
- Zero behaviour change for existing users and routes.
- `code_sample/` shrinks to the files that still have work attached, making the remaining sub-issues easier to
  scope.
