# Issue: Organizations: docs fold and spec cleanup (wrap-up)

## Description

Part of epic #25 (Organizations: optional org ownership for domain data), and its **last**
sub-issue. Citadel is a project template; organizations ship with it so derived projects can have
domain data owned by an organization instead of a single user. The epic was built against the
temporary feature spec in `docs/agents/specs/orgs/` (hub: `README.md`), with the original
implementation mirrored under `docs/agents/specs/orgs/code_sample/`.

This issue **wraps up** the epic per the specs hub's lifecycle (`docs/agents/specs.md`, step 4):
fold what lasts from the spec pages into the permanent docs, adapted to citadel, then delete the
spec folder.

**Depends on:** all other sub-issues of epic #25, **and #33 (Per-user cache)**. #33 ports the last
two files left under `code_sample/` (`backend/src/core/cache-class.ts` and
`cache-policy.interceptor.ts`, the `X-Cache-Allow` per-caller model) and rewrites the caching docs
for that model, so it must be merged before this issue deletes `code_sample/`.

## Problem

- About 5,000 lines of spec pages under `docs/agents/specs/orgs/` are still the only place that
  documents much of the built feature: the owner-context mechanism, the roles matrix, security
  reasoning, edge cases and testing rules. The permanent `docs/agents/modules/auth/organizations.md`
  covers mainly what was implemented (tables, service, routes, frontend).
- The spec pages are written about the original project: they reference `bank`, the original
  project (`ward`) and its issue numbers, a roadmap of epics citadel will not track, and porting
  instructions (`code-sample*.md`) that no longer apply.
- Links (`docs/agents/specs.md`, `architecture/backend.md`, `modules/auth/organizations.md`) and code
  comments (`backend/src/todo/tests/...`, `backend/src/core/owner-scoped.decorator.ts`) point into
  the spec or its `bank` sample.
- Organizations are missing from the doc indexes (`index.md`, `summary.md`, `backend/routes.md`),
  and `product.md` plus the `architect`/`product-owner` agent files still say the ownership chain is
  undecided.

## Expected Behavior

- Everything that matters from `docs/agents/specs/orgs/*.md` lives in the permanent docs, condensed
  and adapted to citadel: no references to `bank` (use the **todo** module as the example), to the
  original project, or to its issue numbers.
- The roadmap (`roadmap.md`) is **dropped**: the future organization epics (joining, closing,
  creation rate limit, moving/sharing records, authorship) will be implemented in another project
  and brought back into citadel from there. Mentions of them on other spec pages (e.g.
  `general.md`'s "Deferred work", "nothing is deletable") are folded only as **current
  limitations**.
- `docs/agents/specs/orgs/` is deleted entirely, including `code_sample/`, which must already be empty
  thanks to #33. **If anything is still there when this issue starts, stop and report it** as an
  unmet dependency (do not delete it), so it can be ported or explicitly waived first.
- `docs/agents/specs.md` is kept and lists Organizations under **Completed specs**. **Active specs**
  reads "none".
- No link, anchor or code comment in the repo points into the removed spec pages or the `bank`
  sample.
- No behaviour change: source edits are comment-only.

## Solution

### Fold map

Guiding rule: **what describes the built feature is folded; what describes the porting process is
dropped.** Cross-cutting mechanisms get their own architecture page instead of growing the module
page. Content is **condensed**: keep rules, invariants, contracts and rationale; drop repetition
across pages, worked examples and meta sections (expect roughly 1/4–1/3 of the original size).

| Spec page(s) | Destination | Notes |
|---|---|---|
| `README.md`, `general.md`, `glossary.md` | `docs/agents/modules/auth/organizations.md` — new intro + a short **Terminology** section | Keep the two meanings of "owner" and "Personal", design principles, what exists today. Drop the reading order. |
| `models.md`, `tables.md`, `migrations.md` | `organizations.md` → **Tables** (expanded: invariants, `ON DELETE RESTRICT`, what the tables do not have) | The `bank` logical-reference example becomes todo. |
| `service.md`, `response.md` | `organizations.md` → **`OrganizationService`** (create invariant, membership-lookup port, transaction boundaries, response allowlist) | |
| `endpoints.md` | **New `docs/agents/backend/routes/orgs.md`** (the four `/orgs` routes, `:orgId` parsing, the `400 > 404 > 403` check order, errors, what the routes never contain), following the existing `routes/auth.md`/`admin.md`/`todo.md` pages | `organizations.md`'s **Routes** section becomes a short summary linking there. Skip what `auth.md` already states (e.g. `/api` prefix). |
| `owner-context.md`, `roles.md` | **New `docs/agents/architecture/owner-context.md`**: layering rule, guard flow, check order, owner filters, decorators (`@OwnerScopedController`, `@OwnerScoped`, `@CurrentOwner`, `@MinOrgRole`), roles matrix, the three enforcement points, adding an action, consequences for a new owner-scoped module | Cross-cutting core mechanism. `architecture/backend.md`'s "Owner context" section keeps its summary and links here instead of the spec pages. |
| `security.md` | `docs/agents/architecture/security.md` → new **Owner-scoped data** section (404/403 contract, no client-supplied owner or role, the global admin grants nothing, personal data is owner-only, the user reference means owner never creator, name validation) **including the data-access review checklist** | The checklist (from `security.md`/`tests.md`) lives here, not in `.claude/agents/data-access.md`. |
| `caching.md` | `docs/agents/architecture/caching.md` | See **Caching** below. |
| `edge-cases.md` | `organizations.md` → condensed **Edge cases** section | |
| `frontend.md` | `organizations.md` → **Frontend**, gaps only (`forbiddenRefreshEffect`, after a write, two tabs, what the frontend does not do) | Most of it is already there. |
| `tests.md` | `organizations.md` → **Testing**, plus the owner-context page for the coverage spec (failure-mode table, code-point counting, rules the tests encode) | |
| `examples.md` | **Dropped** (optionally one request/response sample per route in `routes/orgs.md`) | Duplicates the endpoints content. |
| `code-sample.md`, `code-sample-backend.md`, `code-sample-frontend.md`, `code-sample-migrations.md` | **Dropped** | Porting instructions only; nothing left to port. |
| `roadmap.md` | **Dropped**, except its "Documented divergence that will not change" table | The divergence rows describe the code as built (`auth_` table names, `ON DELETE RESTRICT`, "exactly one owner" held by `OrganizationService#create` being the only writer, code-point name validation, body validated before lookup, `@StrictBody()`, no `/api` prefix in the backend, list ordered by id). Fold each into the matching section as plain fact, without the "spec said" comparison. |
| Every page's "What is not documented in the repository" section | **Dropped** | Meta about the spec itself. |

### Caching

- `architecture/caching.md` describes **citadel's current behaviour only**. #33 owns rewriting it for
  the per-caller model. This issue only folds the organization-specific caching rules from the spec's
  `caching.md` (why owner-scoped GETs are never `public`, what invalidates a role change, rules when
  adding an owner-scoped route, what caching does not protect) **as far as they hold after #33**.
  Anything in the spec that is still not true is dropped, not documented as future work.

### The specs hub (`docs/agents/specs.md`)

`specs.md` is **kept**: it is the permanent hub for future feature specs and already states it is
never deleted. Follow its existing Lifecycle step 4 without changing its rules:

- Move the Organizations row from **Active specs** to **Completed specs**: feature
  "Organizations (domain data owned by a group of users instead of one user); specs were
  `specs/orgs/`, removed by #32", folded into `modules/auth/organizations.md`,
  `architecture/owner-context.md`, `architecture/security.md`, `architecture/caching.md` and
  `backend/routes/orgs.md`, epic [#25](https://github.com/darthjee/citadel/issues/25).
- **Active specs** then reads "none".
- Once `specs/orgs/` is deleted, `docs/agents/specs/` has no files left and disappears from git.
  That is expected: `folder-structure.md` already describes it as holding temporary per-feature
  folders, and the next feature's first sub-issue recreates it.
- `AGENTS.md`, `summary.md` and `folder-structure.md` link only to the hub, never to `specs/orgs/`.
  The `specs` mentions in `contributing.md` and `.claude/agents/frontend.md` are about Jasmine test
  specs and are unrelated.

### Indexes and product definitions

- Register the new and previously unlisted pages: `docs/agents/index.md` and
  `docs/agents/summary.md` gain `modules/auth/organizations.md`, `architecture/owner-context.md` and
  `backend/routes/orgs.md`. `docs/agents/backend/routes.md` gains the `/orgs` routes entry.
- Update the "ownership chain is still open" wording in `docs/agents/product.md` (lines ~40/52/57),
  `.claude/agents/product-owner.md` (~15-17) and `.claude/agents/architect.md` (~126-128). The
  template now ships **user-or-organization ownership** (owner-context, organization roles), while
  each derived project still defines its own domain entities and editing rules. Link to
  `architecture/owner-context.md` and `modules/auth/organizations.md`.

### Edge cases

- **Links into the removed spec pages** (as of writing): `docs/agents/specs.md:59` (handled by the
  specs-hub move), `docs/agents/architecture/backend.md:190-191` (point at
  `architecture/owner-context.md` instead) and `docs/agents/modules/auth/organizations.md:8` (drop
  the "target behaviour lives in the spec" sentence). Re-grep the whole repo for `specs/orgs` and
  `code_sample` before finishing; nothing may remain.
- **Source-code comments that cite the spec or the `bank` sample**: fix them, **comment-only, no
  behaviour change**:
  - `backend/src/todo/tests/support/owner-matrix.ts:6` (points at `code_sample/.../bank/...`);
  - `backend/src/todo/tests/org-roles.e2e-spec.ts:18` ("ported from the organizations spec's bank
    sample");
  - `backend/src/core/owner-scoped.decorator.ts:28` (uses `bank` as the example path → `todo`).
  Point them at the permanent docs, such as `architecture/owner-context.md`, where a reference helps.
- **Mentions of where code came from (the original project)** outside the spec are removed too:
  `docs/agents/architecture/backend.md:14` ("per ward's precedent") and
  `docs/agents/modules/auth/organizations.md:184` ("ported from ward"). State the fact without naming
  its origin.
- **Existing anchors into reorganized pages must keep working**: `architecture/frontend.md:80` →
  `organizations.md#frontend`, `modules/auth.md:148` → `organizations.md#tables`,
  `architecture/backend.md:217` → `organizations.md#the-port-binding`. Either keep those headings or
  update the links.
- **Broken anchor that predates this issue**: `organizations.md:11` links
  `backend.md#owner-context-organizations`, but the heading is `## Owner context`
  (`#owner-context`). Fix it while there.
- **Spec vs. code conflicts**: where a spec statement no longer matches the implementation (e.g.
  `CacheTokenService` described as a per-caller key), the code wins. Fold the corrected fact, or drop
  the statement; never fold spec text that is out of date.

### Agents

- **architect**: all documentation changes, including `.claude/agents/architect.md` and
  `.claude/agents/product-owner.md`.
- **backend**: the three comment-only source edits.
- No cache, data-access or security review: nothing changes behaviour.

## Benefits

- The epic closes with one permanent, citadel-specific source of truth for organizations and the
  owner-context mechanism, instead of a temporary spec written about another project.
- Derived projects (and agents) find owner-scoped rules where they look for them: architecture pages,
  the module page, the routes index and the security/caching docs.
- No dangling links, stale `bank`/`ward` references or "ownership is undecided" statements left
  behind.
