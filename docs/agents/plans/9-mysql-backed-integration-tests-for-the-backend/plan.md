# Plan: MySQL-backed integration tests for the backend

Issue: [9-mysql-backed-integration-tests-for-the-backend.md](../../issues/9-mysql-backed-integration-tests-for-the-backend.md)

## Overview

Add a MySQL-backed integration suite (`*.integration-spec.ts`, run by `yarn test:integration` with
its own Jest config) next to the existing fake-backed unit/e2e specs. Infra provides a throwaway
`mysql:9.3.0` database in docker-compose (`tmpfs`) and in a new CircleCI `backend_integration` job;
backend provides the Jest config, a shared `DataSource` harness and the first specs (migration
round-trip, #3 and #5 migrations on real rows, refresh-rotation race and rollback, and the
`SessionService` join). `yarn test` / `yarn coverage` and the `backend_tests` job stay
database-free and unchanged.

## Agents involved

- [infra](infra.md)
- [backend](backend.md)

## Shared contracts

- **Script:** `backend/package.json` gains `"test:integration": "jest --config jest.integration.config.ts --runInBand"`.
  Infra calls exactly `yarn test:integration` (compose) / `npm run test:integration` (CI); it needs
  no other backend command.
- **Spec naming:** integration specs end in `.integration-spec.ts`; the unit `jest.config.ts`
  `testRegex` (`.*\.(spec|e2e-spec)\.ts$`) already does not match them and stays as is.
- **Connection env vars** (read only by the integration harness, never by `data-source.ts`,
  `AppModule`, `yarn test` or `yarn coverage`):

  | Var | Compose (`citadel_placeholder_tests`) | CircleCI (`backend_integration`) |
  |---|---|---|
  | `CITADEL_PLACEHOLDER_TEST_MYSQL_HOST` | `mysql_test` | `127.0.0.1` |
  | `CITADEL_PLACEHOLDER_TEST_MYSQL_PORT` | `3306` | `3306` |
  | `CITADEL_PLACEHOLDER_TEST_MYSQL_USER` | `citadel_placeholder` | `citadel_placeholder` |
  | `CITADEL_PLACEHOLDER_TEST_MYSQL_PASSWORD` | `citadel_placeholder` | `citadel_placeholder` |
  | `CITADEL_PLACEHOLDER_TEST_MYSQL_NAME` | `citadel_placeholder_test` | `citadel_placeholder_test` |

- **MySQL container** (compose service `citadel_placeholder_mysql_test` and the CI service
  container): image `mysql:9.3.0`, `MYSQL_DATABASE=citadel_placeholder_test`,
  `MYSQL_USER=citadel_placeholder`, `MYSQL_PASSWORD=citadel_placeholder`,
  `MYSQL_ROOT_PASSWORD=citadel_placeholder`. Compose: data dir `/var/lib/mysql` on `tmpfs`, no
  volume, no host port; `citadel_placeholder_tests` links it as `mysql_test` and `depends_on` it.
- **Readiness:** backend's Jest `globalSetup` retries connecting until MySQL accepts connections
  (bounded, ~60 s) — infra adds **no** separate wait step.
- **No coverage** from the integration suite: no Codacy upload, `coverage-final` unchanged.
