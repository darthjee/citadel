# Document the helpers

Fold the relevant spec content into the permanent backend docs (`docs/agents/architecture/backend.md`):

- **Layout tree**: add `strict-validation.pipe.ts` (`@StrictBody()`: strict per-parameter body validation) and
  `parse-id.ts` (`parseId` / `ownerNotFound`: strict route id parsing, uniform 404) under `core/`.
- **New "Body validation" section** (near "Error responses"): the global pipe strips unknown fields; `@StrictBody()`
  rejects them with 400 `VALIDATION_FAILED`; when to use which (new owner-scoped/organization handlers use
  `@StrictBody()`; existing routes keep `@Body()` because some rely on stripping, e.g. `password_confirmation`);
  validated once; nested-field caveat (`@ValidateNested()` + `@Type()` required).
- **New "Route ids" note**: `parseId` accepts `^[1-9][0-9]*$` up to `MAX_ID` and answers the uniform 404 (never 400,
  unlike `ParseIntPipe`), so malformed and unknown ids are indistinguishable; `MAX_ID` matches the signed `int`
  primary keys, and a derived project moving to `bigint` must raise it.

In `docs/agents/specs/orgs/security.md` (strict body / name validation sections), point to the new permanent section
rather than duplicating it, where the spec's text is now covered.

## Files to Change
- `docs/agents/architecture/backend.md`: layout + "Body validation" + route-id note
- `docs/agents/specs/orgs/security.md`: cross-reference to the permanent docs
