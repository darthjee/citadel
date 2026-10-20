# Backend Plan: MySQL-backed integration tests for the backend

Main plan: [plan.md](plan.md)

## Shared contracts

- Own `"test:integration": "jest --config jest.integration.config.ts --runInBand"` in
  `backend/package.json`; infra only ever calls that script.
- Integration specs are `*.integration-spec.ts`; the unit `jest.config.ts` stays unchanged.
- Read the connection only from `CITADEL_PLACEHOLDER_TEST_MYSQL_{HOST,PORT,USER,PASSWORD,NAME}`
  (infra sets them: `mysql_test` in compose, `127.0.0.1` in CI). Never fall back to the dev
  `CITADEL_PLACEHOLDER_MYSQL_*` vars — refuse to run if `..._NAME` is unset, so the suite can never
  wipe the dev database.
- `globalSetup` retries the connection (bounded, ~60 s) — infra adds no wait step.

## Steps

- [01 — Jest integration config and harness](backend/01-jest-config-and-harness.md)
- [02 — Migration specs](backend/02-migration-specs.md)
- [03 — Transaction, race and join specs](backend/03-transaction-race-join-specs.md)
- [04 — Docs and comments](backend/04-docs-and-comments.md)

## CI Checks

- backend: `docker-compose run --rm citadel_placeholder_tests yarn test:integration` (CI job: `backend_integration`)
- backend: `docker-compose run --rm citadel_placeholder_tests yarn coverage` (CI job: `backend_tests`)
- backend: `docker-compose run --rm citadel_placeholder_tests yarn lint` (CI job: `backend_checks`)

## Notes

- Never run `yarn`/`node` on the host; always through `docker-compose run --rm citadel_placeholder_tests …`.
- The integration files live under `src/`, so `yarn lint` (`eslint src`) covers them; they are
  `*.ts` files excluded from unit coverage by the existing `!database/**` and spec patterns — keep
  harness code under `src/database/tests/integration/` so it stays out of `yarn coverage`.
- The race spec must not be flaky: assert invariants (exactly one fulfilled, one rejected with
  `UnauthorizedException`, exactly one active row for the session) that hold for any interleaving,
  and repeat the race a few times in one test.
