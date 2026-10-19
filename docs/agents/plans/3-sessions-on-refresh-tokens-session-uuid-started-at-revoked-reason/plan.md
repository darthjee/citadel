# Plan: Sessions on refresh tokens (session_uuid, started_at, revoked_reason)

Issue: [3-sessions-on-refresh-tokens-session-uuid-started-at-revoked-reason.md](../../issues/3-sessions-on-refresh-tokens-session-uuid-started-at-revoked-reason.md)

## Overview

Backend-only groundwork for the user-approval Epic (#1). It turns a chain of rotated refresh tokens
into a session (`session_uuid`, `started_at`) and records why each token was revoked
(`revoked_reason`), so only `rotated` tokens trigger replay detection. Rotation becomes atomic and
single-winner, logout ends the whole session, and the dead `auth_sessions` table is dropped. The
source of truth is
[docs/agents/specs/user-approval/model.md](../../specs/user-approval/model.md).

See [backend.md](backend.md) for the full plan.
