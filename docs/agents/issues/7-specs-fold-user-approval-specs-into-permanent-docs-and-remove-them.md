# Issue: Specs: fold user approval specs into permanent docs and remove them

## Description

Last sub-issue of the user-approval Epic (#1). Every implementation sub-issue is merged (#3, #4,
#5, #12, #6, #14), so the temporary specs in
[`docs/agents/specs/user-approval/`](https://github.com/darthjee/citadel/tree/main/docs/agents/specs/user-approval)
are folded into the permanent docs and then deleted, following the
[specs hub lifecycle](https://github.com/darthjee/citadel/blob/main/docs/agents/specs.md#lifecycle).

## Problem

The permanent docs still describe Citadel before the feature. For example, `modules/auth.md`
lists `status.json` as `{ loggedIn, isAdmin }` and `search.json` with no status filter. The
session-lookup gate, `auth_users.status`, approve and deny, and the frontend pending state are
documented only in the specs folder, which is meant to be temporary.

## Expected Behavior

- The permanent docs describe the feature **as implemented**. Where a spec and the merged code
  disagree, the code wins.
- `docs/agents/specs/user-approval/` is gone. `specs.md` lists the feature under Completed specs,
  points to the permanent docs, and Active specs reads "none".
- No doc or code comment links to or names the removed spec files.

## Solution

Documentation only; no code change except one comment.

### Where each spec goes

| Spec | Permanent home |
|---|---|
| `README.md` product decision (rules, `denied` is final, admins may deny admins, no un-deny) | `product.md` → "What's already decided"; notifications and pagination → "Deferred" |
| `README.md` overview, status model and diagram, lifecycle edge cases | new `modules/auth/user-approval.md` |
| `model.md` (sessions on refresh tokens, `revoked_reason`, `auth_sessions` dropped, `auth_users.status` + backfill) | `modules/auth.md` → Entities and the JWT/refresh-token flow; status rules → `user-approval.md` |
| `gate.md` (`sid` claim, `SESSION_LOOKUP`, `JwtGuard`, `request.user` from the DB row) | `modules/auth.md` → JWT/refresh-token flow and Admin authorization (fresh `isAdmin`); `architecture/security.md` |
| `config.md` | `environment-variables.md` (row already exists, check it), plus a short section in `user-approval.md` |
| `errors.md` (identical `401` body, new error codes, `admin_denied`) | `backend/routes/auth.md` → Shared behavior; error codes per endpoint |
| `security.md` (non-disclosure, races, accepted risks) | `architecture/security.md`, linked from `user-approval.md` |
| `api/auth.md` (status-aware login, register, status, refresh, recover/reset, device poll) | `backend/routes/auth.md` and the route table in `modules/auth.md` |
| `api/admin.md` (search `status` filter, `currentUserId`, approve, deny) | `modules/auth.md` → Admin tool routes; new `backend/routes/admin.md` linked from `backend/routes.md` |
| `ui/user.md` (`pending` on the auth bus, `AuthStatus`, awaiting-approval view, denied login) | `architecture/frontend.md` |
| `ui/admin.md` (status filter, Status column, approve and deny buttons) | `architecture/frontend.md` |

Kept out: "Required tests" sections (the tests now exist in the code), "What Citadel adds",
sub-issue and port-order tables, and the Kerghan comparison. Kerghan links stay only in a
Reference section of `user-approval.md`, by GitHub URL.

### Cleanup

- Delete `docs/agents/specs/user-approval/`.
- `specs.md`: move the entry from Active specs (now "none") to Completed specs, pointing at
  `modules/auth/user-approval.md`.
- `backend/src/auth/tests/auth.controller.user-status.e2e-spec.ts` line 22: repoint the comment
  from the spec files to `modules/auth/user-approval.md`.
- Grep the repo for `specs/user-approval` and the spec file names; nothing may remain outside
  `specs.md`'s Completed entry.
- `index.md` / `summary.md`: add the new pages if they list module pages.

### Agents

architect (docs). The frontend agent reviews the `architecture/frontend.md` changes.

Kerghan reference: commit [`0314aa9`](https://github.com/darthjee/kerghan/commit/0314aa9)
([darthjee/kerghan#394](https://github.com/darthjee/kerghan/issues/394)) and
[modules/auth/user-approval.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/modules/auth/user-approval.md).

## Acceptance criteria

- The permanent docs describe the feature as implemented: endpoints, error codes, the gate, the
  env flag and the frontend states.
- `docs/agents/specs/user-approval/` is deleted and `specs.md` lists it under Completed specs.
- A grep for `specs/user-approval` finds only the Completed specs entry.
