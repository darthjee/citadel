# Plan: Specs: user approval feature definition

Issue: [2-specs-user-approval-feature-definition.md](../../issues/2-specs-user-approval-feature-definition.md)

## Overview

Documentation-only change. Introduce Citadel's permanent specs hub (`docs/agents/specs.md`),
link it from the root doc indexes, and write the user-approval feature specs under
`docs/agents/specs/user-approval/` as ten small files split by concern. The specs are the
source of truth for the implementation sub-issues #3–#6 and are folded into the permanent docs
and removed by #7.

## Context

- Source content: the **Reference specification** section of epic
  [#1](https://github.com/darthjee/citadel/issues/1) (a port of Kerghan's user-approval flow,
  [darthjee/kerghan#389](https://github.com/darthjee/kerghan/issues/389)). Its content is
  carried into the spec files (not just linked), adapted to Citadel. `§n` below refers to the
  sections of that reference specification.
- Hub template: [Kerghan's specs.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs.md).
- Citadel adaptations that apply to every file:
  - Env var prefix is `CITADEL_PLACEHOLDER_` (see `docs/agents/environment-variables.md`), so the
    flag is `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`.
  - The refresh token travels in the request body (`{ refreshToken }`) and lives in
    `localStorage` (`frontend/assets/js/client/AuthSession.js`), not in a cookie.
  - No default user: drop every Kerghan default-user rule (`409 DEFAULT_USER_MANAGED`, boot sync,
    automatic login).
  - Error codes live in `backend/src/core/error-codes.ts` (`ErrorCodes`), error body shape comes
    from `backend/src/core/http-exception.filter.ts`.
- Decisions settled in the issue (record each in the named file): `auth_sessions` dropped by #3
  (`model.md`); `isAdmin` read fresh from the DB (`gate.md`); access tokens without `sid` simply
  invalid, no transition (`gate.md`); `approved` backfill kept (`model.md`); one indexed DB lookup
  per authenticated request accepted (`security.md`); a denied account keeps its username/email
  (`README.md`).
- Every spec file ends with a **Reference** section linking Kerghan sources by GitHub URL
  (`https://github.com/darthjee/kerghan/blob/main/<path>`, commits/issues by URL) — never a local
  file-system path — and a **Required tests** section derived from §12, scoped to that file.
- Specs describe decisions, not code; they name existing Citadel code only to point at the
  convention or file to change.

## Steps

- [01 — Specs hub and links](plan/01-specs-hub-and-links.md)
- [02 — Feature README](plan/02-readme.md)
- [03 — Data model](plan/03-model.md)
- [04 — Gate, config and errors](plan/04-gate-config-errors.md)
- [05 — Auth and admin API](plan/05-api.md)
- [06 — Security](plan/06-security.md)
- [07 — UI](plan/07-ui.md)
- [08 — Review and consistency pass](plan/08-review.md)

## CI Checks

Markdown only; no CI job lints `docs/`. Verify locally that every relative link resolves and that
no local path leaked in:

- `grep -rn "/Users/" docs/agents/specs docs/agents/specs.md` — must print nothing.

## Notes

- Only the architect writes files; product-owner, security and data-access are consulted
  read-only (step 08).
- `product.md`, `modules/auth.md`, `environment-variables.md`, route docs and `CLAUDE.md` are not
  touched (out of scope; #7 handles the permanent docs).
- If writing a file surfaces a decision not covered by the issue, record the chosen option in the
  spec and flag it in the PR description rather than leaving it open.
