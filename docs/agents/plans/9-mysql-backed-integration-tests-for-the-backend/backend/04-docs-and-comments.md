# Docs and comments

- `docs/agents/architecture/backend.md`:
  - stack bullet: "MySQL 8" → MySQL 9.3 (the `mysql:9.3.0` image used in dev, tests and CI);
  - Testing section: replace "No live database in CI yet … Add a `cimg/mysql` service …" with an
    **Integration specs** bullet: `*.integration-spec.ts`, run by `yarn test:integration`
    (`docker-compose run --rm citadel_placeholder_tests yarn test:integration`, never on the host)
    against the throwaway `citadel_placeholder_mysql_test`, the harness in
    `src/database/tests/integration/`, and when to write one (migrations, transactions, races,
    query-builder SQL) vs a fake-backed spec (everything else). Mention that new migrations must
    be added to the harness's migration list (the guard spec enforces it).
- `backend/src/auth/tests/support/in-memory-repo.ts`: the "Real-engine transaction/concurrency
  checks are follow-up #9." comment now points at
  `src/auth/tests/integration/token-rotation.integration-spec.ts`.
- `backend/jest.config.ts`: the `!database/**` comment ("exercised … by `yarn migration:run` …
  against a real database") also mentions the integration suite.

## Files to Change

- `docs/agents/architecture/backend.md` — stack version and Testing section.
- `backend/src/auth/tests/support/in-memory-repo.ts` — comment.
- `backend/jest.config.ts` — comment.
