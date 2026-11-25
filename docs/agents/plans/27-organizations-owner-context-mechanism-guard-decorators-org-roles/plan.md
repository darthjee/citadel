# Plan: Organizations: owner-context mechanism (guard, decorators, org roles)

Issue: [27-organizations-owner-context-mechanism-guard-decorators-org-roles.md](../../issues/27-organizations-owner-context-mechanism-guard-decorators-org-roles.md)

## Overview

Port the owner-context mechanism from `docs/agents/specs/orgs/code_sample/backend/src/core/` into
`backend/src/core/`. That covers org roles, `OwnerContext` and the owner filters, `parseOrgId`, the membership
port, the guard, the owner-scoped/current-owner/min-role decorators and cache invalidation. Register the guard
and the invalidation interceptor globally, binding a fail-closed default lookup until #28. Add the three coverage
specs on a shared route-discovery helper, then remove the ported samples and document the mechanism.
All the work is in the backend.

See [backend.md](backend.md) for the full plan.
