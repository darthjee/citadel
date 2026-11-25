# Organizations - Edge Cases

Hub: [Organizations](README.md).

## Summary

The situations that are easy to get wrong, grouped by where they surface.

| Area | Edge cases |
|---|---|
| Zero organizations | New user, empty list, the normal state |
| User status | Pending, denied, approved |
| Membership loss mid-session | Revoked membership, demoted role |
| Context | Stale remembered id, malformed id, foreign id |
| Writes | Duplicate names, concurrent renames |
| Deletion | Nothing is deletable today |

## Zero organizations

A user who has never created an organization.

| Surface | Behaviour |
|---|---|
| `GET /orgs.json` | `200` with `[]` - **not** `404`, not `null` |
| Context switcher | Shows **Personal** plus **+ Create organization**. No empty-state error |
| Active context | Personal. It is the only context available |
| `ownerRole(ctx)` in Personal | `owner` - so `can()` needs no personal branch |
| `entryResolution` | A remembered organization id cannot match, so it resolves to Personal |

**This is the normal state, not an error state.** Registration creates no organization; an earlier
spec proposed auto-creating one and was reversed before being built (#40).

Consequence for tests and fixtures: a user with zero organizations is the **default** setup, not a
degenerate one. Any test that assumes at least one organization is testing an artificial state.

## `GET /orgs.json` when empty

`[]` with `200`.

The frontend treats an empty array as a valid list:

- The switcher renders only Personal and the create entry.
- No toast, no error banner.
- `OrgListController` caches the empty result like any other.

An error surface here would be wrong: the request succeeded and returned an accurate answer.

## User status

Three states, all enforced at the `JwtGuard` gate.

| Status | Login | Any organization route | Answer |
|---|---|---|---|
| `approved` | Yes | Reaches the organization logic | `200`, `403` or `404` as appropriate |
| `pending` | No | Blocked before it | `401 Invalid or expired access token` |
| `denied` | No | Blocked before it | `401 Invalid or expired access token` |

- A `pending` or `denied` user **never** reaches a `403`. The refusal happens at authentication, not
  at authorization.
- Both statuses answer the **same** `401` body - the caller cannot distinguish "awaiting approval"
  from "denied".
- A user who is demoted from approved to denied while holding an `owner` membership keeps the
  membership row. The organization's data remains, unreachable by them.

**Order matters**: `401` before any `404` or `403`. A suspended user learns nothing about which
organizations exist.

## Membership loss mid-session

A user loses their membership while holding a live session.

| Layer | Behaviour |
|---|---|
| Backend | The next request answers the uniform `404`. The role and the membership are re-read from the DB on **every** request |
| Cached `GET /orgs.json` | May still name the organization until invalidated |
| Frontend | The org list may still list it; clicking it produces `404`, which resolves to `not-found` |
| Remembered context | The stale id is dropped when the id is not in the loaded list |

There is no push and no session invalidation on membership loss. The recovery is reactive: the next
request corrects the state.

Consequence: **the UI can show an organization the user no longer belongs to.** That is UX lag, not a
data leak - every read is refused by the backend.

## Role demotion mid-session

The most common confusing case, because the UI and the API disagree for a moment.

| Layer | Behaviour |
|---|---|
| Backend | Immediate. The next request already sees the new role |
| Frontend | Holds the old role from `GET /orgs.json` until a `403` triggers a refresh |
| Visible result | Controls still shown, action refused |

The sequence:

1. User holds `admin`. The UI shows Rename.
2. The role drops to `user` in the database.
3. User clicks Rename. Backend answers **`403`**.
4. `ApiClient` emits `permission:forbidden` **before** throwing.
5. `forbiddenRefreshEffect` refetches `GET /orgs.json` - once per burst, not per request.
6. The role updates, the Rename link disappears.

The `403` **is** the refresh signal. There is no polling and no push.

### A burst of `403`s

A page with five forbidden requests must not produce five refetches. `forbiddenRefreshEffect` holds
an in-flight flag and collapses the burst into **one** refresh.

Without it, the org-list endpoint receives N requests for one role change, and each of the N `403`s
triggers another.

## Stale remembered context

`ContextStorage` remembers the last organization under `ward.context.<userId>`, but the stored value
can go stale.

| Cause | Result |
|---|---|
| The organization was never real (hand-edited storage) | Dropped by `entryResolution` - not in the loaded list |
| The membership was lost | Dropped - not in the loaded list |
| The user switched accounts | Different key, so no collision |
| `localStorage` unavailable or throwing | `try` / `catch` falls back to Personal |

Rules that make this safe:

- The value is the **organization id only** - no name, no role, no cached body.
- `entryResolution` applies the remembered context **only** at `''` or `#/` - an explicit URL wins.
- A remembered id not present in the loaded list is **forgotten**, not attempted.
- The value is **not cleared on logout**. A stale id is handled by the rules above instead.

## Malformed `:orgId`

The same input, on both sides of the wire.

| Input | Backend | Frontend |
|---|---|---|
| `7` | Accepted | Accepted |
| `0` | `404` | `not-found`, **no request** |
| `007` | `404` | `not-found`, no request |
| `abc` | `404` | `not-found`, no request |
| `1e3` | `404` - not coerced | `not-found`, no request |
| `1.5` | `404` | `not-found`, no request |
| `2147483648` | `404` | `not-found`, no request |
| `2147483647` | Accepted | Accepted |

Two independent guards, same result:

- **Backend**: `parseOrgId()` receives the **raw string**. A number-typed parser would have already
  turned `1e3` into `1000`.
- **Frontend**: `^[1-9][0-9]*$` plus the `2147483647` bound resolves to `not-found` **without issuing
  a request**.

The frontend guard is an optimisation and a UX improvement, not the security boundary. The backend
guard is what protects the data - the frontend check could be bypassed entirely with a direct call.

## Foreign or non-member organization

| Case | Answer |
|---|---|
| Organization exists, caller is not a member | Uniform `404` |
| Organization exists, caller is a **global admin** but not a member | Uniform `404` - identical body |
| Organization was deleted | Uniform `404` |
| Organization id belongs to a different installation | Uniform `404` |

All four are indistinguishable from the response. A global admin cannot tell the difference between
"no such organization" and "exists, not a member".

## Duplicate names

| Situation | Result |
|---|---|
| Same user creates two organizations named "Acme" | **Two organizations.** No dedupe |
| Two different users create "Acme" | Two organizations |
| Rename to a name another organization already has | Allowed |

`name` is **not unique** and has no index. There is no lookup by name anywhere in the API, so
duplicates are not a correctness problem - the routes address by `id`.

Consequence for a client: a name is a label, not an identifier. Two entries in the switcher may read
identically.

## Concurrent renames

Two `PATCH` calls on the same organization.

| Aspect | Behaviour |
|---|---|
| Locking | None |
| Version column | None |
| `If-Match` / ETag | None |
| Outcome | **Last write wins** |

Both callers receive `200`. The final name is whichever write committed last; the other caller's
response is already stale when it arrives.

This is documented as an accepted limitation, not a bug.

## Concurrent creation

Two `POST` calls by the same user, same name.

Both succeed. Two organizations exist. Neither is a duplicate in the schema sense - `name` has no
unique constraint.

## Nothing is deletable

The case that surprises most when exploring the domain.

| Attempt | Result |
|---|---|
| Delete an organization row | **Blocked** by `ON DELETE RESTRICT` while a membership references it |
| Delete a user row | **Blocked** while they belong to any organization |
| Delete a membership | No endpoint, no service method |
| Close an organization | Not built (#83) |

Every organization always has at least its `owner` membership, and removing memberships is not
built. So **no organization row is deletable today, at any layer**.

`RESTRICT` protects against deleting **rows**, not against dropping the table - a migration rollback
works normally.

## Orphaned `organization_id` in a module

A `bank` record may hold an `organization_id` that no longer exists.

| Layer | Behaviour |
|---|---|
| Foreign key | **None.** `bank` references `auth_organizations` logically |
| Database | Will not object, will not cascade, will not warn |
| Application | Must prevent it - which is why closing an organization (#83) is not a simple delete |

This is the consequence of the module separation: the modules are deliberately independent, so the
database cannot enforce the reference.

## Personal context edge cases

| Case | Behaviour |
|---|---|
| Personal request with no organization in the URL | `ownerRole(ctx)` returns `owner` |
| Personal route with a malformed `:orgId` in a query string | Ignored - personal routes take no owner from the URL |
| Switching from an organization back to Personal | `landingFor` returns the module's personal path |
| A personal record with `user_id` set to another user | Impossible to address - personal routes carry no user id |

The last row is structural: there is no route that accepts a user id, so another user's personal data
cannot be named, let alone returned.

## Session expiry mid-form

| Moment | Behaviour |
|---|---|
| Token expires while a rename form is open | The `PATCH` answers `401` |
| Frontend | `isSessionExpired` detects it and routes to the login flow |
| Unsaved input | Lost - there is no draft persistence |

## Two tabs, two contexts

The context lives in the **URL**, so two tabs can work on different contexts at the same time.

| Situation | Behaviour |
|---|---|
| Tab A in Personal, Tab B in organization 1 | Both work; neither is overwritten |
| Tab A creates an organization | Tab B's org list is stale until it refreshes |
| Tab A renames in organization 1 | Tab B, if on the same organization, shows the old name until reload |

`ContextStorage` is per user and stores **one** id - the last one used. It does not coordinate
between tabs beyond that.

## Empty and boundary values for `name`

| Value | Result |
|---|---|
| `""` | `400` |
| `"   "` | `400` - rejected after trimming |
| `"  Acme  "` | Accepted, stored as `Acme` |
| 255 ASCII characters | Accepted |
| 256 ASCII characters | `400` |
| 255 astral characters (an emoji) | **Accepted** - 255 code points, 510 UTF-16 units |
| `"Acme\u0007"` | `400` - control character |
| `"Organização Ágape"` | Accepted |
| `"<script>alert(1)</script>"` | Accepted and stored; rendered literally, not executed |

The astral-character row is the one that separates a correct validation from a naive one. A check
written as `name.length <= 255` measures UTF-16 units and would **reject** a valid name.

## What is not documented in the repository

The project documentation states the empty-list behaviour, the status gate, the stale-context rules,
the malformed-id rules, the last-write-wins outcome and the deletion blockers. It does **not**
contain:

- the behaviour when `localStorage` contains a value for a **different** user id on a shared machine;
- whether `ContextStorage` is cleared by anything other than an explicit switch;
- the exact refresh window used by `forbiddenRefreshEffect` to collapse a burst;
- whether the org list refreshes on login, on window focus, or on both;
- the behaviour of a `PATCH` whose body equals the current name - whether `updated_at` still moves;
- any timeout or retry on a `429` or a network failure;
- what the UI renders when `GET /orgs.json` itself fails with a `500`.

Read `frontend/assets/js/utils/context/`, `frontend/assets/js/components/common/ownerContext/` and
the organization controller specs for the authoritative version. Nothing on this page is inferred
beyond what the docs state.
