import type { Config } from 'jest';
// Jest loads config files through ts-node + Node's native ESM loader ("type": "module"),
// which needs the real file extension here.
// @ts-expect-error TS5097 — `allowImportingTsExtensions` is not enabled for the app build.
import baseConfig from './jest.config.ts';

// MySQL-backed integration suite (`yarn test:integration`). Reuses the unit
// config's `rootDir`/`transform`/`moduleNameMapper` and only swaps which files
// run: `*.integration-spec.ts`, against the throwaway database described by
// `CITADEL_PLACEHOLDER_TEST_MYSQL_*` (see
// `src/database/tests/integration/test-data-source.ts`). No coverage is
// collected — `yarn coverage` stays the database-free source of coverage.
//
// There is deliberately no `globalSetup`: Jest loads it with plain Node
// `require`, bypassing `moduleNameMapper`, so it can't import our `.js`-suffixed
// NodeNext sources. Waiting for MySQL to accept connections lives in
// `createTestDataSource()` instead (bounded retry, ~60 s).
const config: Config = {
  ...baseConfig,
  testRegex: '.*\\.integration-spec\\.ts$',
  collectCoverage: false,
  collectCoverageFrom: undefined,
  coverageDirectory: undefined,
  // Generous: a spec's `beforeAll` may wait up to 60 s for MySQL to boot.
  testTimeout: 90_000,
};

export default config;
