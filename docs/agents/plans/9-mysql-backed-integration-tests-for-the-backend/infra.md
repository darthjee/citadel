# Infra Plan: MySQL-backed integration tests for the backend

Main plan: [plan.md](plan.md)

## Shared contracts

- Run `yarn test:integration` (compose) / `npm run test:integration` (CI); backend owns the script
  and its Jest config.
- Provide the `CITADEL_PLACEHOLDER_TEST_MYSQL_*` vars with the values in [plan.md](plan.md#shared-contracts)
  (`mysql_test` in compose, `127.0.0.1` in CI).
- MySQL container: `mysql:9.3.0`, `MYSQL_DATABASE=citadel_placeholder_test`,
  `MYSQL_USER`/`MYSQL_PASSWORD`=`citadel_placeholder`, `MYSQL_ROOT_PASSWORD=citadel_placeholder`.
- No wait step: backend's Jest `globalSetup` retries the connection itself.

## Implementation Steps

### Step 1 — docker-compose test database

- Add `citadel_placeholder_mysql_test` (`mysql:9.3.0`, the env above, `tmpfs: /var/lib/mysql`,
  no `volumes`, no `ports`, no `env_file` so dev `.env` values cannot leak in). A short comment says
  it is throwaway and used only by the integration suite.
- `citadel_placeholder_tests`: add `links: [citadel_placeholder_mysql_test:mysql_test]` (keeping
  the `mysql` link inherited from `base` — YAML merge replaces the list, so repeat it) and
  `depends_on: [base_build, citadel_placeholder_mysql_test]`.
- `.env.dev.sample`: add the five `CITADEL_PLACEHOLDER_TEST_MYSQL_*` vars (compose values) under
  the MySQL settings, with a one-line comment ("integration suite only").

### Step 2 — CircleCI job and infra docs

- New job `backend_integration` (its own `jobs:` entry, since `yarn_project` has one image only):
  `docker:` = `darthjee/circleci_citadel_placeholder-base:0.0.1` (same as `backend_tests`) plus a
  `mysql:9.3.0` service image with the container env above; job-level `environment:` sets the
  `CITADEL_PLACEHOLDER_TEST_MYSQL_*` CI values. Steps: `checkout`, `setup_project: { dir: backend }`,
  `run: npm run test:integration` (step name `Integration tests`).
- Workflow entry: `requires` the same base-image release jobs as `backend_tests`, `filters: *all_tags`;
  add `backend_integration` to the `requires` of `build-and-release`, `upload_proxy_files` and
  `upload_fe_files` (next to `backend_tests`). Not added to `coverage-final`.
- Replace the stale "No DB service container yet … cimg/mysql:8.0" workflow comment with one
  describing the split: unit/e2e specs use fakes (`backend_tests`), `*.integration-spec.ts` run
  against MySQL in `backend_integration`.
- Validate with `docker-compose run --rm circleci config validate`.
- `docs/agents/architecture/infra.md`: add `backend_integration` to the job table and the workflow
  diagram/`requires` prose; describe `citadel_placeholder_mysql_test` with the compose services.
- `docs/agents/environment-variables.md`: add the five `CITADEL_PLACEHOLDER_TEST_MYSQL_*` rows
  (consumed by the integration harness only; file: `backend/src/database/tests/integration/`).

## Files to Change

- `docker-compose.yml` — new `citadel_placeholder_mysql_test`; links/depends_on on `citadel_placeholder_tests`.
- `.env.dev.sample` — `CITADEL_PLACEHOLDER_TEST_MYSQL_*`.
- `.circleci/config.yml` — `backend_integration` job + workflow entry + `requires`; comment fix.
- `docs/agents/architecture/infra.md` — job table, workflow, compose service.
- `docs/agents/environment-variables.md` — new vars.

## CI Checks

- root: `docker-compose run --rm circleci config validate` (validates `.circleci/config.yml`)
- backend: `docker-compose run --rm citadel_placeholder_tests yarn test:integration` (CI job: `backend_integration`)

## Notes

- Existing developers' `.env` lacks the new vars; the compose service should therefore also set
  them under `citadel_placeholder_tests.environment` so `docker-compose run --rm
  citadel_placeholder_tests yarn test:integration` works without editing `.env`.
- `infra.md` documents the CI image as `0.1.0` while the config uses `0.0.1`; follow the config,
  do not change the image tag here.
