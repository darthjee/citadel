# Feature Specs

Permanent hub for **feature specs**: temporary, agreed definitions of a multi-issue feature that
its implementation sub-issues build against. This hub is never deleted; the feature folders it
lists are.

## Purpose

`docs/agents/specs/<feature>/` holds one feature's definition while its sub-issues are being
built. While the folder exists, it is the **source of truth** for that feature: implementation
issues read it instead of making their own decisions about the data model, API, security or UI.

A spec folder is not a plan and not an issue file:

| Folder | Holds | Lifetime |
|---|---|---|
| `issues/` | One issue's description | Until that issue is merged |
| `plans/` | One issue's implementation steps | Until that issue is merged |
| `specs/<feature>/` | The shared definition several issues and plans point at | Until the feature's last sub-issue folds it into the permanent docs |

## Lifecycle

1. A feature's **first** sub-issue writes the specs under `docs/agents/specs/<feature>/` and adds
   an entry to [Active specs](#active-specs) below.
2. The implementation sub-issues build against the specs. A sub-issue that changes a decision
   updates the spec **in the same PR**.
3. The feature's **last** sub-issue folds the lasting content into the permanent docs
   (`product.md`, `modules/`, `backend/routes/`, `environment-variables.md`, …).
4. That last sub-issue then deletes `docs/agents/specs/<feature>/` and moves its entry from
   [Active specs](#active-specs) to [Completed specs](#completed-specs), pointing at the permanent
   docs that now hold it.

This hub itself is **permanent**: it is never deleted, even when no spec is active. When no
feature is in progress, [Active specs](#active-specs) reads "none".

Root instruction files (`AGENTS.md`, `CLAUDE.md`) and the doc indexes (`index.md`, `summary.md`)
link to this hub, never to a feature's spec folder. When a spec is added, moves or completes, only
this file changes.

## Conventions

- **One `README.md` per feature**: overview, purpose, scope, the product decision behind it, and
  an index linking every other file in the folder.
- **Files split by concern** (e.g. `model.md`, `api/…`, `security.md`, `ui/…`), so each
  implementation sub-issue reads only what it needs. The `README.md` maps sub-issues to files.
- **Subfolders for variants or areas** (e.g. `api/auth.md`, `api/admin.md`).
- **Every file ends with**:
  - a **Reference** section — external sources linked by their GitHub web URL
    (`https://github.com/<owner>/<repo>/blob/main/<path>`, commits and issues by URL), **never** a
    local file-system path;
  - a **Required tests** section, next to the rules it verifies.
- Specs describe **decisions**, not code. They name existing code only to point at the file or
  convention to change.

## Active specs

| Feature | Specs | Epic |
|---|---|---|
| User approval (optional admin approval of new registrations, plus the session-lookup gate it needs) | [specs/user-approval/README.md](specs/user-approval/README.md) | [#1](https://github.com/darthjee/citadel/issues/1) |

## Completed specs

Features whose specs were folded into the permanent docs, and where their definition lives now.

none
