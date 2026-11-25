# Plan: Organizations: core groundwork (strict body pipe, parse-id)

Issue: [26-organizations-core-groundwork-strict-body-pipe-parse-id.md](../../issues/26-organizations-core-groundwork-strict-body-pipe-parse-id.md)

## Overview
Port `@StrictBody()` (`StrictValidationPipe`) and `parseId` from the organizations code sample into
`backend/src/core/`, with their specs plus the missing edge-case specs. Document both in the backend
architecture docs, and delete the sample copies of core files that need no port. No existing route changes
behaviour.

See [backend.md](backend.md) for the full plan.
