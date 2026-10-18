# Issue: Specs: user approval feature definition

## Description

First step of the user-approval Epic (#1): write the feature specs that every following
sub-issue implements against, and introduce Citadel's permanent specs hub. Documentation only,
no code changes.

The source is the **Reference specification** section of #1 (a port of Kerghan's flow, see
[darthjee/kerghan#389](https://github.com/darthjee/kerghan/issues/389) and its specs
sub-issue [#390](https://github.com/darthjee/kerghan/issues/390)), adapted to Citadel.

**Agents:** architect (author); consult product-owner, security and data-access.

## Problem

The approval feature spans five implementation sub-issues (#3–#7) touching the data model,
the authentication gate, auth and admin endpoints, and the frontend. Without one agreed
definition, each sub-issue would make its own decisions about statuses, error codes, races and
non-disclosure, and they would drift. Citadel also has no convention for such shared, temporary
feature definitions: `docs/agents/specs.md` does not exist, and `AGENTS.md` / `index.md` only
point at `issues/` and `plans/`.

## Expected Behavior

### In scope

1. **Specs hub** — add `docs/agents/specs.md`, adapted from
   [Kerghan's](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs.md): purpose,
   lifecycle (first sub-issue writes the specs, implementation sub-issues build against them and
   update them when a decision changes, last sub-issue folds them into the permanent docs and
   deletes the feature folder), conventions, and Active / Completed specs lists. The hub is
   **permanent**: it outlives this feature and stays as the home for future specs, reading
   "none" under Active specs when nothing is in progress. Register
   `docs/agents/specs/user-approval/` under Active specs.
2. **Hub links** — link `specs.md` from the docs table in `AGENTS.md`, from
   `docs/agents/index.md` and `docs/agents/summary.md`, and add `specs/` to
   `docs/agents/folder-structure.md`. Root files link only to the hub, never to a feature folder,
   so completing a feature changes only `specs.md`.
3. **Feature specs** in `docs/agents/specs/user-approval/`, with the file layout described
   under Solution.
4. The specs cover **every** implementation sub-issue of #1 — refresh-token sessions, the `sid`
   gate, the user-side flow and the admin review — not only the approval part.
5. The specs record the Citadel-specific decisions listed under Solution.

### Out of scope

- Any code, migration or test (the implementation sub-issues).
- Changes to the permanent docs (`modules/auth.md`, `environment-variables.md`, route docs,
  `product.md`): the product decision lives in the specs `README.md` for now and is moved to
  `product.md` by the fold-and-remove sub-issue.
- `CLAUDE.md` (it only points at `AGENTS.md`).
- Default user, notifications, admin listing pagination, un-deny.

### Acceptance criteria

- `docs/agents/specs/user-approval/` exists with the file layout under Solution, each file ending with
  its Reference line (GitHub URLs only, no local paths) and Required tests section.
- `docs/agents/specs.md` exists as a permanent hub and lists the feature under Active specs.
- `AGENTS.md`, `index.md`, `summary.md` and `folder-structure.md` link to the hub.

## Solution

### Spec files

The content of that reference specification is carried into the specs (not just linked),
split by concern into small files so each one stays readable and each implementation
sub-issue reads only what it needs:

```
docs/agents/specs/user-approval/
├── README.md        overview, product decision, status model + transitions (§1),
│                    gap analysis (§2), port order (§13), scope / out of scope, index
├── model.md         refresh-token sessions (§3.1), auth_users.status + backfill (§5),
│                    revoked reasons, auth_sessions decision, migration/deploy order
├── gate.md          sid claim, SESSION_LOOKUP port, JwtGuard, approved requirement (§3.2–3.4, §6)
├── config.md        CITADEL_USER_APPROVAL_REQUIRED (§4)
├── errors.md        error codes + identical 401 body (§11, §3.4)
├── security.md      non-disclosure (§8), races, accepted risks
├── api/
│   ├── auth.md      login, register, status, refresh, recover/reset, device poll (§7)
│   └── admin.md     search filter, approve, deny (§9)
└── ui/
    ├── user.md      AuthEvents/AuthStatus, awaiting-approval view, denied login (§10.1–10.4)
    └── admin.md     admin users page (§10.5)
```

(§ numbers refer to the Reference specification in #1.)

Every file:

- Carries over the Kerghan code samples and request / response bodies, adapted to Citadel
  (refresh token in the request body, no default user, `CITADEL_` prefix).
- Ends with a **Reference** line pointing at the Kerghan sources for its sections. References
  never use local file-system paths: link to the web version on GitHub
  (`https://github.com/darthjee/kerghan/blob/main/<path>`), and to Kerghan commits / issues by
  their GitHub URLs.
- Ends with a **Required tests** section, derived from §12 and scoped to that file's rules.

Which sub-issue reads which files:

| Sub-issue | Reads |
|---|---|
| #3 Sessions on refresh tokens | `model.md` (sessions part) |
| #4 Session-lookup gate | `gate.md`, `errors.md` |
| #5 User-side approval flow | `model.md` (status part), `config.md`, `api/auth.md`, `security.md`, `ui/user.md` |
| #6 Admin review | `api/admin.md`, `ui/admin.md`, `errors.md` |
| #7 Fold into permanent docs and remove | all of them |

### Citadel-specific decisions

- The refresh token stays in the request body + `localStorage` (no cookie move); the `pending`
  `status.json` answer must not make the frontend drop the stored refresh token.
- No default user: skip every Kerghan default-user rule.
- **Legacy `auth_sessions` table: dropped** (decided). Today `TokenService#touchSession` inserts
  a new row on every token issuance (login, register, refresh, winning device poll) and nothing
  ever reads it, so it is dead, ever-growing data. Once a session is the refresh-token chain
  identified by `session_uuid`, everything it could tell is already there (`started_at`, latest
  `issued_at`). `model.md` records the decision: remove the `Session` entity, `touchSession` and
  the repository injection, and add a migration dropping `auth_sessions` (`down` recreates the
  empty table). Implemented by #3 (Sessions on refresh tokens), as Kerghan did
  ([20261009120019-auth-drop-sessions.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/database/migrations/20261009120019-auth-drop-sessions.ts)).
- **`isAdmin` read fresh from the DB** (decided). `JwtGuard` builds `request.user` from the
  user row returned by the session lookup, not from the JWT claims, so `AdminGuard` and
  `@CurrentUser()` always see current values: a demoted admin loses admin access on the next
  request, not after the access-token TTL. `gate.md` records it.
- **`approved` backfill kept** (decided). Even though Citadel is a template, the status
  migration still backfills existing rows to `approved` before `NOT NULL`, so a project built
  from it that already has users is not locked out. `model.md` records it.
- **One DB lookup per authenticated request accepted** (decided): a single indexed query on
  `session_uuid`; `security.md` records it with the other accepted risks / costs.
- **Access tokens without `sid`: simply invalid** (decided). Citadel is a template for future
  projects, with no live user base to migrate, so there is no transition path for pre-`sid`
  tokens: the gate rejects them like any invalid token (the frontend's refresh-and-retry on
  `401` mints a `sid`-bearing one anyway).

### Edge cases to specify

Each one goes into the named spec file, with matching Required tests.

**Races (`security.md`)**

1. Concurrent approve vs deny: approve is a conditional update from `pending`, so it never
   overwrites a deny; the loser gets `422 USER_NOT_PENDING`.
2. A rotation or winning device poll racing deny's bulk revoke: `refresh.json` re-checks
   `denied` and revokes the presented token with `admin_denied`; the poll re-checks the status
   before minting; the gate requires `approved` regardless.
3. Deny on an already denied user: allowed, still revokes any active token.

**Status lifecycle (`README.md`, `api/auth.md`)**

4. A pending user keeps their session; once approved, the next request passes with no new login.
5. A pending user's refresh token expires while waiting: they log in again (login works for
   pending users) and land back on the awaiting-approval view.
6. Toggling the flag never changes existing users; pending users stay pending when it is
   turned off.
7. Password reset: pending can reset and stays pending; a denied user's reset token gets the
   same generic `400` as an unknown one and is not consumed.
8. Device authorization: a non-approved approver gets the gate's `401`; the requester is
   re-checked before the session is minted (`logged → denied`).
9. A denied account keeps its username and email: `denied` is final and the row is never
   deleted, so re-registering with them gets the existing "already taken" error. Intended — it
   discloses nothing registration does not already disclose. No special handling.

**Admins (`api/admin.md`)**

10. Self-deny is refused (`422 CANNOT_DENY_SELF`); admins may deny other admins. Accepted risk:
    one admin can deny every other admin.
11. An admin demoted or denied while on the admin page: the next admin call fails immediately
    (`401` if denied, `403` from `AdminGuard` if demoted).

**Frontend (`ui/user.md`)**

12. Refresh token in `localStorage`: the pending `status.json` answer keeps it; denied /
    anonymous answers drop it.
13. Several open tabs: each re-checks `status.json` on window focus, so an approval reaches
    them all without timer polling.

## Benefits

- A single source of truth for #3–#6: each implementation issue reads only its own small spec
  files instead of re-deciding the design.
- Decisions specific to Citadel (template with no live users, refresh token in the body, no
  default user, `auth_sessions` dropped, fresh `isAdmin`) are settled once, up front.
- A permanent specs hub that future multi-issue features in Citadel (and projects built from
  it) can reuse.
