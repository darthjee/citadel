# Flow

## Status

Stub. Citadel Placeholder is a template: only the generic login flow is implemented. Each project derived
from this template documents its own end-to-end request/data flow here, and keeps it updated as
decisions change (see [Product Definitions](product.md)).

## Overview

The backend (NestJS) owns account/login state and the application's persisted data; the
frontend (React/Vite) is served alongside it through the Tent proxy (see
[Architecture](architecture.md)).

## Step by step

1. **Login.** The user logs into Citadel Placeholder (a lightweight, backend-owned account): username/
   password, verified against a bcrypt digest, backed by a JWT `access_token` cookie and a
   rotating refresh token (see `docs/agents/modules/auth.md`). The frontend's route-independent
   login modal (`LoginModal`) is the single entry point for this — Password/Register/Recover
   modes, plus a device-authorization mode: the user can instead ask an already-logged-in device
   to vouch for their username, and poll until that device approves or denies the request.

2. _Application-specific steps go here._

## Per-user cache (upcoming)

User-scoped read paths must bypass Tent's shared HTTP cache: they are declared
`@CachePolicy(CacheClass.UserScoped)`, which sends `X-Skip-Cache` (see
[API Caching](architecture/caching.md) and
[Cache Warmer](cache-warmer.md#per-user-cache-upcoming)). A per-user cache layer is in active
development on Tent itself and is expected to take over these read paths once available —
update this section and `cache-warmer.md` together once that lands.

## Open questions

_None recorded yet._
