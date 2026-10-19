# Plan: Session-lookup gate: sid claim checked on every authenticated request

Issue: [4-session-lookup-gate-sid-claim-checked-on-every-authenticated-request.md](../../issues/4-session-lookup-gate-sid-claim-checked-on-every-authenticated-request.md)

## Overview
Access tokens gain a `sid` claim (the refresh-token session's `session_uuid`), and `JwtGuard`
checks that session against the database on every authenticated request, building `request.user`
from the user row. Backend only, no migration.

See [backend.md](backend.md) for the full plan.
