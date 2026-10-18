# User approval

Feature specs for epic [#1](https://github.com/darthjee/citadel/issues/1): optional admin
approval of self-registered accounts, plus the session-lookup gate it depends on. This folder is
the **source of truth** for sub-issues #3–#6 and is folded into the permanent docs and deleted by
#7 (see the [specs hub](../../specs.md)).

The feature is a port of Kerghan's flow
([darthjee/kerghan#389](https://github.com/darthjee/kerghan/issues/389)), adapted to Citadel
Placeholder: the refresh token travels in the request body and lives in `localStorage` (no
cookie), there is no default user, and env vars use the `CITADEL_PLACEHOLDER_` prefix.

## Overview

With the feature flag on, a self-registered account starts as `pending` and cannot use the
application until an admin approves it. Admins can also **deny** any account: reject a pending
one, or ban an approved one. With the flag off (the default), registration behaves as today
(accounts start `approved`), but the admin review tools and the status gate still exist.

## Product decision

_Kept here until #7 moves it to [product.md](../../product.md)._

- Citadel Placeholder accounts carry a **status**: `pending`, `approved` or `denied`.
- New-account approval is **optional**, controlled by one boot-time env flag
  ([config.md](config.md)). It only decides the status of a new self-registration.
- Admins review accounts from the existing admin users page: filter by status, approve pending
  accounts, deny any account other than their own.
- `denied` is final: there is no un-deny through the application.
- No notifications: approve/deny send no email, and admins are not alerted of new pending
  registrations.

## Status model

| Status | Meaning |
|---|---|
| `pending` | Registered while approval was required; waiting for an admin |
| `approved` | Can use the application normally |
| `denied` | Rejected or banned; final |

```
          register (flag on)              register (flag off)
                 │                                │
                 ▼                                ▼
           ┌─────────┐        approve       ┌──────────┐
           │ pending │ ───────────────────▶ │ approved │
           └─────────┘                      └──────────┘
                 │                                │
            deny │                                │ deny (ban)
                 ▼                                ▼
           ┌──────────────────────────────────────────┐
           │                  denied                  │ ◀── deny again: allowed
           └──────────────────────────────────────────┘     (still revokes sessions)
```

Rules:

- **Only `approved` users are authenticated.** Enforced on **every** authenticated request by the
  session gate in `JwtGuard` ([gate.md](gate.md)), **always** — the flag never turns it off.
  Pending and denied users look anonymous to every business endpoint.
- **approve** is strict: only from `pending` (anything else → `422 USER_NOT_PENDING`).
- **deny** is lenient: from **any** status, so it covers both "reject" and "ban".
- **`denied` is final**: no endpoint leaves it (only a manual DB change can).
- The status changes **only** through approve and deny. Admin edit, My Account, password reset
  and every other write path never touch it.

## Lifecycle edge cases

1. **A pending user keeps their session.** Login and register give a pending user a real
   session; the gate blocks its access tokens. As soon as an admin approves, the **next** request
   with the same access token passes — no new login.
2. **A pending user's refresh token expires while waiting.** They log in again (login works for
   pending users) and land back on the awaiting-approval view.
3. **Toggling the flag never changes existing users.** Turning it off does not approve pending
   users; turning it on does not make approved users pending.
4. **A denied account keeps its username and email.** `denied` is final and the row is never
   deleted, so registering again with the same username or email gets the existing
   `409 USERNAME_TAKEN` / `EMAIL_TAKEN` error. Intended: it discloses nothing that registration
   does not already disclose. No special handling.

Password reset and device authorization are covered in [api/auth.md](api/auth.md); races in
[security.md](security.md).

## What Citadel adds

| Piece | Citadel today | Action | Spec |
|---|---|---|---|
| `session_uuid` / `started_at` on refresh tokens | none | **Add** — a session is one chain of rotated tokens | [model.md](model.md) |
| `revoked_reason` on refresh tokens | only `revoked_at` | **Add** — only `rotated` triggers replay detection | [model.md](model.md) |
| `auth_sessions` table | written on every issuance, never read | **Drop** | [model.md](model.md) |
| `sid` claim + `SESSION_LOOKUP` + gate in `JwtGuard` | `JwtGuard` trusts the JWT claims | **Add** | [gate.md](gate.md) |
| `auth_users.status`, `UserApprovalConfig` | none | **Add** | [model.md](model.md), [config.md](config.md) |
| Status-aware auth endpoints | none | **Add** | [api/auth.md](api/auth.md) |
| Admin status filter, approve, deny | `search.json` / `edit.json` exist | **Extend / add** | [api/admin.md](api/admin.md) |
| Frontend pending state, awaiting-approval view, denied login | none | **Add** | [ui/user.md](ui/user.md) |
| Admin page filter, status column, approve/deny buttons | users page exists | **Extend** | [ui/admin.md](ui/admin.md) |
| Refresh token transport | body + `localStorage` | **Keep** (no cookie move) | [ui/user.md](ui/user.md) |
| Default user | none | **Skip** (Kerghan-only) | — |

## Sub-issues and the files they read

Sub-issues are sequential; each builds on the previous one being merged.

| Sub-issue | Reads |
|---|---|
| #3 Sessions on refresh tokens | [model.md](model.md) (sessions part) |
| #4 Session-lookup gate | [gate.md](gate.md), [errors.md](errors.md) |
| #5 User-side approval flow | [model.md](model.md) (status part), [config.md](config.md), [api/auth.md](api/auth.md), [security.md](security.md), [ui/user.md](ui/user.md) |
| #6 Admin review | [api/admin.md](api/admin.md), [ui/admin.md](ui/admin.md), [errors.md](errors.md) |
| #7 Fold into permanent docs and remove | all of them |

Port order inside those sub-issues:

1. Sessions on refresh tokens (`session_uuid`, `started_at`, `revoked_reason`, drop
   `auth_sessions`). Rotation copies the session.
2. Session-lookup gate: `sid` claim, `SESSION_LOOKUP`, `JwtGuard` check, `request.user` from the
   DB.
3. Status column + migration with the `approved` backfill, `UserStatus`,
   `RevokedReason.ADMIN_DENIED`, and `user.status = 'approved'` in the lookup — **one deploy**.
4. Config flag + register.
5. Status-aware auth endpoints: login, status, refresh, recover/reset, poll.
6. Frontend user side: `pending` on the bus, `AuthStatus`, re-check after login/register,
   awaiting-approval view, denied login message.
7. Admin API: search filter + `currentUserId`, approve, deny.
8. Frontend admin side: filter, status column, approve/deny buttons.

## Scope

In scope: everything listed under [What Citadel adds](#what-citadel-adds).

Out of scope:

- The default user (Citadel Placeholder has none) and every Kerghan rule tied to it
  (`409 DEFAULT_USER_MANAGED`, boot sync, `status.json` automatic login).
- Notifications on approve/deny or on new pending registrations.
- Pagination of the admin user listing.
- Un-deny.
- Moving the refresh token into a cookie.

## Index

| File | Contents |
|---|---|
| [model.md](model.md) | Refresh-token sessions, revoked reasons, `auth_sessions` drop, `auth_users.status` + backfill, migration/deploy order |
| [gate.md](gate.md) | `sid` claim, `SESSION_LOOKUP` port, `JwtGuard`, the `approved` requirement |
| [config.md](config.md) | `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` |
| [errors.md](errors.md) | New error codes, the identical `401` body, `admin_denied` |
| [security.md](security.md) | Non-disclosure, races, accepted risks and costs |
| [api/auth.md](api/auth.md) | Status-aware auth endpoints (login, register, status, refresh, recover/reset, device poll) |
| [api/admin.md](api/admin.md) | Admin search filter, approve, deny |
| [ui/user.md](ui/user.md) | Auth bus `pending`, `AuthStatus`, awaiting-approval view, denied login |
| [ui/admin.md](ui/admin.md) | Admin users page: filter, status column, approve/deny |

## Reference

- Kerghan permanent doc for this feature:
  [modules/auth/user-approval.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/modules/auth/user-approval.md)
- Kerghan epic [#389](https://github.com/darthjee/kerghan/issues/389) and specs sub-issue
  [#390](https://github.com/darthjee/kerghan/issues/390)
- Kerghan commits:
  [`3f3c691`](https://github.com/darthjee/kerghan/commit/3f3c691) (session-lookup gate),
  [`b29312e`](https://github.com/darthjee/kerghan/commit/b29312e) (user side),
  [`a4b0c3e`](https://github.com/darthjee/kerghan/commit/a4b0c3e) (admin side),
  [`0314aa9`](https://github.com/darthjee/kerghan/commit/0314aa9) (docs folded)
- Citadel epic [#1](https://github.com/darthjee/citadel/issues/1) (Reference specification)

## Required tests

Cross-cutting end-to-end scenarios (each detailed in the file named):

- **Flag off**: registration answers and behaves exactly as today; the new user is `approved` and
  passes the gate ([config.md](config.md), [api/auth.md](api/auth.md)).
- **Flag on**: a new registration is `pending`; its access token gets the gate's `401` on a
  business endpoint; `status.json` answers `pending`; after an admin approves, the **same**
  access token passes with no new login ([gate.md](gate.md), [api/admin.md](api/admin.md)).
- **Deny**: denying a logged-in user makes their next request answer the gate's `401` on every
  session, `refresh.json` answers `401`, and `status.json` gives the anonymous answer
  ([api/admin.md](api/admin.md), [api/auth.md](api/auth.md)).
- **Flag toggled**: existing `pending` users stay `pending` after the flag is turned off
  ([config.md](config.md)).
- **Denied re-registration**: registering again with a denied account's username or email gets
  the existing `409` ([api/auth.md](api/auth.md)).
