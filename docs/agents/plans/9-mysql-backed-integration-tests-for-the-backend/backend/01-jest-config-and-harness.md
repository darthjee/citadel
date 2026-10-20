# Jest integration config and harness

Set up the integration runner and the shared real-DB helpers every integration spec uses.

- `backend/jest.integration.config.ts`: same `transform`/`moduleNameMapper`/`rootDir` as
  `jest.config.ts` (import and spread it, overriding only what differs), `testRegex:
  '.*\\.integration-spec\\.ts$'`, no coverage, `globalSetup` pointing at the harness, a generous
  `testTimeout` (e.g. 30 s).
- `package.json`: `"test:integration": "jest --config jest.integration.config.ts --runInBand"`.
- `src/database/tests/integration/test-data-source.ts`:
  - `testDataSourceOptions()` builds options from `dataSourceOptions` (`data-source.ts`), overriding
    host/port/user/password/database from `CITADEL_PLACEHOLDER_TEST_MYSQL_*`, and passing the five
    entity classes and every migration class **directly** (an explicit, ordered array of the
    `src/database/migrations/[0-9]*` classes — the `dist/**/*.js` globs do not resolve under
    `@swc/jest`); `migrationsRun: false`, `synchronize: false`, `poolSize` ≥ 2 (the race spec needs
    two connections). Throws if `CITADEL_PLACEHOLDER_TEST_MYSQL_NAME` is unset.
  - `createTestDataSource()` → initialized `DataSource`.
  - `resetDatabase(ds)`: drop every table (incl. TypeORM's `migrations` table) so each spec file
    starts empty; then the spec runs migrations itself (`ds.runMigrations()` or a subset).
  - `runMigrationsUpTo(ds, migrationName)`: runs pending migrations one at a time until (and
    including) the named one, so a migration spec can seed rows before running its target.
- `src/database/tests/integration/global-setup.ts`: retry `createTestDataSource()` until it
  connects (e.g. every 1 s, up to 60 s), then destroy it; fail with a clear message on timeout.
- Add a guard test that the migration array is complete: compare it with the files in
  `src/database/migrations/` (timestamp-prefixed) so a new migration that is not registered fails
  the suite.

## Files to Change

- `backend/jest.integration.config.ts` — new.
- `backend/package.json` — `test:integration` script.
- `backend/src/database/tests/integration/test-data-source.ts` — new harness.
- `backend/src/database/tests/integration/global-setup.ts` — new readiness wait.
- `backend/src/database/tests/integration/migrations-registry.integration-spec.ts` — completeness guard.
