# Plan: Organizations: frontend foundation (routing, context, permissions, client)

Issue: [29-organizations-frontend-foundation-routing-context-permissions-client.md](../../issues/29-organizations-frontend-foundation-routing-context-permissions-client.md)

## Overview

Port the organizations frontend foundation from `docs/agents/specs/orgs/code_sample/frontend/`
(routing, owner context, permissions, client, provider/hooks/controllers), adapt it to citadel, and
wire it into the app with no visible change. The backend adds `userId` to the approved
`status.json` answer so the remembered context can be keyed per user. Organization pages, routes,
switcher and `NotFound` stay for #30; module routes for #31.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

`POST /auth/status.json` (`SessionStatusService#status`):

| Case | Body |
|---|---|
| Active session, approved user | `{ "loggedIn": true, "isAdmin": <boolean>, "userId": <number> }` (new `userId`: the caller's own `User.id`) |
| Active session, pending user | `{ "loggedIn": false, "isAdmin": false, "status": "pending" }` (unchanged, no `userId`) |
| Anonymous / denied / unknown | `{ "loggedIn": false, "isAdmin": false }` (unchanged, no `userId`) |

Frontend consumers: `AuthStatus` reads `userId` (defaults to `null` when absent) and forwards it as
the 4th argument of `AuthEvents.emit(loggedIn, isAdmin, pending, userId)`; the event detail becomes
`{ loggedIn, isAdmin, pending, userId }`. `OrgListController` keys `ContextStorage` with it.

`GET /orgs.json` (merged in #28) returns the caller's organizations with their `role`; the frontend
only consumes it.
