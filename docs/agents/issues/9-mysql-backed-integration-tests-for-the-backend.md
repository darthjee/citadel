# Issue: MySQL-backed integration tests for the backend

## Description

The backend has no tests that run against a real database:

- service and e2e specs use in-memory repositories (`backend/src/auth/tests/support/`), whose fake
  `manager.transaction` is explicitly "not a real transaction" and defers real-engine checks to #9;
- migration specs (since #3) use a fake `QueryRunner` (`backend/src/database/tests/fake-query-runner.ts`);
- `.circleci/config.yml` and `docs/agents/architecture/backend.md` (Testing) say no DB service exists
  yet and that one should be added "alongside the first spec that actually needs one".

Kerghan has the same gap (fake `QueryRunner` plus in-memory repos, MySQL only in dev
docker-compose), so there is nothing to port.

## Problem

Fakes cannot check behaviour that only a real MySQL shows:

- migration backfills, e.g. `UPDATE … SET session_uuid = UUID()` giving every row a distinct value,
  or #5's `status` column added nullable, backfilled to `approved`, then made `NOT NULL`;
- `NOT NULL` and index constraints really applied, and `down` really reverting `up`;
- a transaction actually rolling back;
- two concurrent requests racing on a conditional update, as in #3's single-winner refresh rotation;
- the real SQL of query-builder joins, such as #4/#5's `SessionService#findActiveSessionUser`
  (`auth_users` ⋈ `auth_refresh_tokens`), which the unit spec only checks with a mocked builder.

## Expected Behavior

- `docker-compose run --rm citadel_placeholder_tests yarn test:integration` runs the integration
  suite against a throwaway MySQL that starts empty on every run and never touches dev data.
- CI runs the same suite in its own job against a MySQL service container; the existing
  `backend_tests` (`yarn coverage`) and `backend_checks` jobs stay database-free and unchanged.
- A migration, transaction or race bug that the fakes hide fails the integration suite.

## Solution

### docker-compose (infra)

- New `citadel_placeholder_mysql_test` service: `mysql:9.3.0` (same image as dev), data dir on
  `tmpfs` (no volume, so every run starts empty), its own database/user credentials, no host port
  needed.
- `citadel_placeholder_tests` links to it and depends on it; the integration DB connection comes
  from dedicated env vars (e.g. `CITADEL_PLACEHOLDER_TEST_MYSQL_*`) so `yarn test` / `yarn coverage`
  are unaffected. Document new vars in `.env.dev.sample` and `docs/agents/environment-variables.md`.

### CircleCI (infra)

- New `backend_integration` job: the backend image plus a `mysql:9.3.0` service container, running
  `yarn test:integration` (waits for MySQL to accept connections first). Added to the
  `build-and-release` / `upload_*` `requires` lists alongside the other test jobs. No coverage upload.
- Replace the stale "No DB service container yet … cimg/mysql:8.0" comment.

### Jest (backend)

- New `backend/jest.integration.config.ts` matching `*.integration-spec.ts` only, plus a
  `test:integration` script; the unit config's `testRegex` keeps excluding them.
- Shared support (e.g. `src/database/tests/integration/`) that builds a `DataSource` from
  `dataSourceOptions` overridden for the test DB, passing the **entity and migration classes
  directly** (the `dist/**/*.js` globs do not work under `@swc/jest`).
- State reset between tests (drop/re-run migrations or truncate tables), `runInBand`.

### First tests (backend)

- **Round-trip smoke:** all migrations `up` → `down` (all) → `up` succeed on the real engine.
- **#3 migrations against real data** (run up to the preceding migration, seed rows, run the target):
  distinct `session_uuid` backfill per row, `started_at = issued_at`, `revoked_reason` backfill,
  `auth_sessions` drop and `down` recreate.
- **#5 `users.status` migration:** existing rows (incl. demo seeds) backfilled to `approved`, column
  ends `NOT NULL` with no default, `down` drops it.
- **Refresh rotation:** concurrent `TokenService#rotateTokens` on the same presented row → exactly one
  winner, one active row per session; the loser's replacement insert is rolled back.
- **Rollback on failure:** a failing step inside the rotation transaction leaves no replacement row
  and the presented row unrevoked.
- **`SessionService#findActiveSessionUser`** on real rows: returns the user for an active session of
  an `approved` user; `null` for revoked, expired, unknown `sid`, or `pending`/`denied` user.

### Docs

- `docs/agents/architecture/backend.md` Testing section: describe the integration suite, how to run
  it (always through docker-compose, never on the host), and when to write an integration spec vs a
  fake-backed spec; fix the "MySQL 8" mention to the actual version.
- `docs/agents/architecture/infra.md`: the new compose service and CI job.
- Update the `in-memory-repo.ts` "follow-up #9" comment to point at the integration specs.

### Out of scope

- Races on #6's `approveUser` and the device-authorization poll's single-winner `UPDATE`
  (candidates for a follow-up once the harness exists).
- Moving existing fake-backed specs to the real DB.

### Agents

infra (compose, CI, infra docs), backend (Jest config, support, tests, backend docs).

## Acceptance criteria

- `docker-compose run --rm citadel_placeholder_tests yarn test:integration` passes from a clean state.
- CI `backend_integration` passes; `backend_tests` and `backend_checks` unchanged and green.
- `yarn lint` and `yarn coverage` pass (through docker-compose).

## Benefits

Migrations, transactions and race-sensitive queries get checked against the real engine, so a
project built from this template catches schema or race bugs before they reach production, and the
harness is in place for every future DB-dependent spec.
