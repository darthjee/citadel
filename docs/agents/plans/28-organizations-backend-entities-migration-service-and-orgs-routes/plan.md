# Plan: Organizations: backend entities, migration, service and /orgs routes

Issue: [28-organizations-backend-entities-migration-service-and-orgs-routes.md](../../issues/28-organizations-backend-entities-migration-service-and-orgs-routes.md)

## Overview

Port the organizations backend from `docs/agents/specs/orgs/code_sample/backend/src/` into `backend/src/`:
entities, migration, `OrganizationService` (the real `ORGANIZATION_MEMBERSHIP_LOOKUP`), the four `/orgs` routes,
their specs and test support. Swap #27's fail-closed AppModule binding for the `AuthModule` binding, add a
MySQL integration spec, delete the ported samples and fold the docs. All work is in the backend agent's scope.

See [backend.md](backend.md) for the full plan.
