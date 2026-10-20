import { DataSource, DataSourceOptions, MigrationInterface } from 'typeorm';
import { AccountEditLockout } from '../../../auth/entities/account-edit-lockout.entity.js';
import { AuthorizationRequest } from '../../../auth/entities/authorization-request.entity.js';
import { PasswordResetToken } from '../../../auth/entities/password-reset-token.entity.js';
import { RefreshToken } from '../../../auth/entities/refresh-token.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { dataSourceOptions } from '../../data-source.js';
import { AuthCreateUsers20260824120001 } from '../../migrations/20260824120001-auth-create-users.js';
import { AuthCreateRefreshTokens20260824120002 } from '../../migrations/20260824120002-auth-create-refresh-tokens.js';
import { AuthCreateSessions20260824120003 } from '../../migrations/20260824120003-auth-create-sessions.js';
import { AuthSeedDemoUser20260824120004 } from '../../migrations/20260824120004-auth-seed-demo-user.js';
import { AuthCreatePasswordResetTokens20260901120005 } from '../../migrations/20260901120005-auth-create-password-reset-tokens.js';
import { AuthAddUsersIsAdmin20260903120006 } from '../../migrations/20260903120006-auth-add-users-is-admin.js';
import { AuthPromoteDemoUserAdmin20260903120007 } from '../../migrations/20260903120007-auth-promote-demo-user-admin.js';
import { AuthCreateAuthorizationRequests20260903120008 } from '../../migrations/20260903120008-auth-create-authorization-requests.js';
import { AuthAddAuthorizeLockoutColumns20260909120009 } from '../../migrations/20260909120009-auth-add-authorize-lockout-columns.js';
import { AuthCreateAccountEditLockouts20260914120010 } from '../../migrations/20260914120010-auth-create-account-edit-lockouts.js';
import { AuthAddRefreshTokensSession20261018120011 } from '../../migrations/20261018120011-auth-add-refresh-tokens-session.js';
import { AuthAddRefreshTokensRevokedReason20261018120012 } from '../../migrations/20261018120012-auth-add-refresh-tokens-revoked-reason.js';
import { AuthDropSessions20261018120013 } from '../../migrations/20261018120013-auth-drop-sessions.js';
import { AuthAddUsersStatus20261019120014 } from '../../migrations/20261019120014-auth-add-users-status.js';

type MigrationClass = new () => MigrationInterface;

/**
 * Every migration, in timestamp order, paired with its file's basename (no extension).
 * Passed to TypeORM as classes because the `dist/**` globs in `data-source.ts` don't resolve
 * under `@swc/jest`. A new migration must be added here — the registry integration spec fails
 * otherwise.
 */
export const MIGRATIONS: ReadonlyArray<{ file: string; migration: MigrationClass }> = [
  { file: '20260824120001-auth-create-users', migration: AuthCreateUsers20260824120001 },
  { file: '20260824120002-auth-create-refresh-tokens', migration: AuthCreateRefreshTokens20260824120002 },
  { file: '20260824120003-auth-create-sessions', migration: AuthCreateSessions20260824120003 },
  { file: '20260824120004-auth-seed-demo-user', migration: AuthSeedDemoUser20260824120004 },
  { file: '20260901120005-auth-create-password-reset-tokens', migration: AuthCreatePasswordResetTokens20260901120005 },
  { file: '20260903120006-auth-add-users-is-admin', migration: AuthAddUsersIsAdmin20260903120006 },
  { file: '20260903120007-auth-promote-demo-user-admin', migration: AuthPromoteDemoUserAdmin20260903120007 },
  { file: '20260903120008-auth-create-authorization-requests', migration: AuthCreateAuthorizationRequests20260903120008 },
  { file: '20260909120009-auth-add-authorize-lockout-columns', migration: AuthAddAuthorizeLockoutColumns20260909120009 },
  { file: '20260914120010-auth-create-account-edit-lockouts', migration: AuthCreateAccountEditLockouts20260914120010 },
  { file: '20261018120011-auth-add-refresh-tokens-session', migration: AuthAddRefreshTokensSession20261018120011 },
  { file: '20261018120012-auth-add-refresh-tokens-revoked-reason', migration: AuthAddRefreshTokensRevokedReason20261018120012 },
  { file: '20261018120013-auth-drop-sessions', migration: AuthDropSessions20261018120013 },
  { file: '20261019120014-auth-add-users-status', migration: AuthAddUsersStatus20261019120014 },
];

/** Every entity the app maps, so repositories resolve against the test database. */
export const ENTITIES = [AccountEditLockout, AuthorizationRequest, PasswordResetToken, RefreshToken, User];

/**
 * Builds the integration-suite connection options: the app's `dataSourceOptions`, pointed at the
 * throwaway test database from `CITADEL_PLACEHOLDER_TEST_MYSQL_*`. Deliberately never falls back
 * to the dev `CITADEL_PLACEHOLDER_MYSQL_*` vars — the suite drops every table, so it refuses to
 * run without an explicit test database name.
 *
 * @param env - the environment to read from (defaults to `process.env`).
 * @returns the TypeORM options for the test database.
 */
export function testDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const database = env.CITADEL_PLACEHOLDER_TEST_MYSQL_NAME;
  if (!database) {
    throw new Error(
      'CITADEL_PLACEHOLDER_TEST_MYSQL_NAME is not set — refusing to run the integration suite ' +
      '(it drops every table). Run it via `docker-compose run --rm citadel_placeholder_tests yarn test:integration`.',
    );
  }

  return {
    ...dataSourceOptions,
    type: 'mysql',
    host: env.CITADEL_PLACEHOLDER_TEST_MYSQL_HOST,
    port: Number(env.CITADEL_PLACEHOLDER_TEST_MYSQL_PORT ?? 3306),
    username: env.CITADEL_PLACEHOLDER_TEST_MYSQL_USER,
    password: env.CITADEL_PLACEHOLDER_TEST_MYSQL_PASSWORD,
    database,
    poolSize: 5,
    entities: ENTITIES,
    migrations: MIGRATIONS.map(({ migration }) => migration),
    migrationsRun: false,
    synchronize: false,
    logging: false,
  };
}

/** How long `createTestDataSource()` keeps retrying while MySQL is still booting. */
export const CONNECT_TIMEOUT_MS = 60_000;
const CONNECT_INTERVAL_MS = 1_000;

/**
 * Creates and initializes a `DataSource` against the test database, retrying every second for up
 * to `CONNECT_TIMEOUT_MS` while MySQL is still booting (`docker-compose run` / the CI job may start
 * before it accepts connections), so no separate wait step is needed.
 *
 * @param timeoutMs - how long to keep retrying before giving up.
 * @returns the initialized data source; callers must `destroy()` it.
 */
export async function createTestDataSource(timeoutMs = CONNECT_TIMEOUT_MS): Promise<DataSource> {
  const options = testDataSourceOptions();
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      return await new DataSource(options).initialize();
    } catch (error) {
      if (Date.now() >= deadline) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Test MySQL did not accept connections within ${timeoutMs / 1000}s: ${reason}`);
      }
      await new Promise((resolve) => setTimeout(resolve, CONNECT_INTERVAL_MS));
    }
  }
}

/**
 * Drops every table in the test database (including TypeORM's `migrations` table), so a spec file
 * starts from an empty schema and runs the migrations it needs itself.
 *
 * @param ds - an initialized test data source.
 * @returns resolves once every table is gone.
 */
export async function resetDatabase(ds: DataSource): Promise<void> {
  const rows: Array<{ name: string }> = await ds.query(
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
  );
  if (rows.length === 0) return;

  const tables = rows.map(({ name }) => `\`${name}\``).join(', ');
  const runner = ds.createQueryRunner();
  try {
    await runner.query('SET FOREIGN_KEY_CHECKS = 0');
    await runner.query(`DROP TABLE IF EXISTS ${tables}`);
  } finally {
    await runner.query('SET FOREIGN_KEY_CHECKS = 1');
    await runner.release();
  }
}

/**
 * Runs the pending migrations up to and including `migrationName` (and none after it), so a spec
 * can seed rows in the pre-migration shape before running its target migration. Uses a short-lived
 * data source whose migration list stops at the target, since `DataSource#runMigrations` always
 * runs every pending migration it knows about.
 *
 * @param ds - an initialized test data source (its options are reused).
 * @param migrationName - the class name of the last migration to run.
 * @returns resolves once `migrationName` has run.
 */
export async function runMigrationsUpTo(ds: DataSource, migrationName: string): Promise<void> {
  const index = MIGRATIONS.findIndex(({ migration }) => migration.name === migrationName);
  if (index === -1) throw new Error(`Unknown migration: ${migrationName}`);

  const migrations = MIGRATIONS.slice(0, index + 1).map(({ migration }) => migration);
  const partial = await new DataSource({ ...ds.options, migrations, poolSize: 1 }).initialize();
  try {
    await partial.runMigrations({ transaction: 'each' });
  } finally {
    await partial.destroy();
  }
}
