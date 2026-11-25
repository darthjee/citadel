# Expand modules/auth/organizations.md

Turn `docs/agents/modules/auth/organizations.md` into the single permanent page for the
organizations module, folding in the spec pages listed below.

- **Intro** (from `README.md`/`general.md`): what an organization is, design principles, what exists
  today and its **current limitations** (no member management, no deletion, no creation cap), stated
  as facts with no future-epic references. Remove the line-8 sentence saying the target behaviour
  lives in `docs/agents/specs/orgs/`.
- **Terminology** (from `glossary.md`): the two meanings of "owner" (organization role vs. record
  owner) and of "Personal", plus the few terms an agent would otherwise misread.
- **Tables** (from `models.md`, `tables.md`, `migrations.md`): keep the `## Tables` heading (anchor
  `#tables`, linked from `modules/auth.md:148`). Add the invariants, `ON DELETE RESTRICT` on both
  FKs and why, what the tables deliberately do not have, the "exactly one owner" invariant held by
  `OrganizationService#create` being the only writer (no DB constraint), and the logical reference
  from owner-scoped modules, using **todo** instead of `bank`.
- **`OrganizationService`** (from `service.md`, `response.md`): the create invariant, `listForUser`
  ordered by id, `findOne`, `rename` and where its role check lives, transaction boundaries, the
  membership-lookup port. Keep `### The port binding` (anchor `#the-port-binding`, linked from
  `architecture/backend.md:217`). Add the response serializer as an allowlist: `role` is the
  caller's, and what is never in a response.
- **Routes**: shorten to a summary table that links `../../backend/routes/orgs.md` (step 04).
- **Frontend** (from `frontend.md`, gaps only): keep the `## Frontend` heading (anchor `#frontend`,
  linked from `architecture/frontend.md:80`). Add `forbiddenRefreshEffect`, the behaviour after a
  write, two tabs with two contexts, and what the frontend does not do. At line ~184, replace
  "(ported from ward)" with a plain statement.
- **Edge cases** (from `edge-cases.md`), condensed: zero organizations, user status, membership loss
  or demotion mid-session, stale remembered context, malformed or foreign `:orgId`, duplicate names,
  concurrent renames and creation, nothing is deletable, orphaned `organization_id`, session expiry,
  two tabs, `name` boundary values.
- **Testing** (from `tests.md`): the organization-specific specs, code-point counting, and the rules
  the tests encode. The coverage-spec and failure-mode material lives in `owner-context.md`; link it.
- Fold the roadmap's "Documented divergence" rows into the sections above as plain facts (table
  names, `ON DELETE RESTRICT`, single-writer owner invariant, code-point name validation, body
  validated before lookup, `@StrictBody()`, no `/api` prefix in the backend, list ordered by id).
- Fix line 11's broken anchor: `backend.md#owner-context-organizations` → `backend.md#owner-context`.
- Link `../../architecture/owner-context.md` wherever the mechanism is mentioned instead of
  re-explaining it.

## Files to Change

- `docs/agents/modules/auth/organizations.md`: expanded per above; existing anchors `#tables`, `#the-port-binding` and `#frontend` preserved
