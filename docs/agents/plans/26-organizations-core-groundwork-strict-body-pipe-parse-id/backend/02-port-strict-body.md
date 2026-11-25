# Port StrictValidationPipe / @StrictBody() with edge-case specs

Move `docs/agents/specs/orgs/code_sample/backend/src/core/strict-validation.pipe.ts` to `backend/src/core/strict-validation.pipe.ts` unchanged, and
`docs/agents/specs/orgs/code_sample/backend/src/core/tests/strict-validation.pipe.spec.ts` to `backend/src/core/tests/strict-validation.pipe.spec.ts`.
Keep the existing cases (unknown field → 400, invalid field → 400, valid body → DTO instance, plain `@Body()`
still stripped by the `main.ts`-equivalent global pipe), then add:

1. **Missing / empty body**: POST with no body and with `{}` to the strict route → 400 (never 500, never 201).
2. **Non-object JSON body**: `[]`, `[{"name":"ok"}]`, `"ok"`, `1` (sent as `application/json`) → 400.
   If one of these does not answer 400 with the unchanged pipe, record the actual behaviour in the spec and in
   the issue/PR notes rather than silently changing the pipe; the goal is to stay identical to the original.
3. **Nested unknown fields**: a DTO with a nested object, (a) marked `@ValidateNested()` + `@Type(() => Child)`:
   an unknown nested field → 400; (b) without them: pin down the actual behaviour. Add a short comment in the
   pipe's JSDoc (or in docs, step 04) about the caveat.
4. **Through citadel's real filter**: a test app registering `{ provide: APP_FILTER, useClass: HttpExceptionFilter }`
   plus `LoggingModule` (same pattern as `core/tests/request-logging.e2e-spec.ts`); an unknown field answers 400 with
   body `error.code === 'VALIDATION_FAILED'` and `error.details` containing `'property <x> should not exist'`.
5. **Validated once**: spy on `StrictValidationPipe.prototype.transform` (or the DTO validation) and assert one call
   per request with the global `ValidationPipe({ whitelist: true, transform: true })` installed.

Keep the spec under the 300-line `max-lines` lint limit. Split into a second file (e.g.
`strict-validation.pipe.e2e-spec.ts`) if needed. Delete both sample files once moved.

## Files to Change
- `backend/src/core/strict-validation.pipe.ts`: new (moved from the sample)
- `backend/src/core/tests/strict-validation.pipe.spec.ts`: new (moved + extended)
- `backend/src/core/tests/strict-validation.pipe.e2e-spec.ts`: optional, only if the spec grows past the lint limit
- `docs/agents/specs/orgs/code_sample/backend/src/core/strict-validation.pipe.ts`, `docs/agents/specs/orgs/code_sample/backend/src/core/tests/strict-validation.pipe.spec.ts`: deleted
