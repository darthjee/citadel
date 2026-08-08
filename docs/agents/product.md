# Product Definitions

**Status: stub.** Citadel Placeholder is a template for a web application (NestJS backend + React/Vite
frontend). Only the generic, template-level decisions are recorded below; each project derived
from this template fills in its own product definitions. This file is the canonical place for
the `product-owner`, `data-access`, and `security` agents to check "is this decided yet?" —
anything not listed here should be treated as undecided and flagged.

## What's already decided (template-level)

- **Accounts and login**: users log into Citadel Placeholder itself with username/password, backed by a JWT
  `access_token` cookie and a rotating refresh token, either directly or by having an
  already-logged-in device approve the login through the device-authorization flow (see
  [Auth](modules/auth.md) and [Flow](flow.md)).
- **Admin tooling**: narrowly-scoped admin UI/endpoints are allowed, gated behind the admin role
  and `@AdminOnly()` — this is not general admin-panel scaffolding.
- **Transactional email**: sent through the always-on [Mail](modules/mail.md) module (disabled
  by default; log-and-skip).
- **Env vars for the framework**: simple env-driven config, read once at boot (no hidden env
  reads inside classes) — `CITADEL_PLACEHOLDER_SECRET_KEY` (session/cookie signing), `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS`
  (CORS allowlist, falling back to `FRONTEND_BASE_URL`'s origin — format and production wildcard
  rule in [Environment Variables](environment-variables.md)), `NODE_ENV`/`DEBUG`.

## Product specifics

_To be defined by the project built from this template._

- **What the app is** and its core value.
- **Entities**: the domain entities and what each one represents.
- **Ownership chain**: who owns what (e.g. user → resource).
- **Roles**: which roles exist beyond regular user/admin and what each may do.
- **Editing rules**: who may create, update, or delete each entity.

## Deferred (future, not current scope)

_None recorded yet._

## What's still open

- The domain data model and everything downstream of it: entity definitions, ownership chain,
  role definitions, editing rules, and the API endpoint shape.

## Once the data model is decided

- Fill in "Product specifics" above with entity definitions, ownership chain, roles, and editing
  rules.
- Update `docs/agents/index.md`/`summary.md` to describe this file's real content instead of a
  stub.
- Write `docs/agents/access-control.md` (or fold access rules into this file).
- Update `.claude/agents/product-owner.md` and `.claude/agents/data-access.md` to reference the
  real rules instead of "flag by default."
