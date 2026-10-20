import type { DataSource } from 'typeorm';
import { tableNames } from './schema-inspection.js';
import { createTestDataSource, MIGRATIONS, resetDatabase } from './test-data-source.js';

describe('migrations round trip (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('runs every migration up, all the way down, and up again', async () => {
    const ran = await ds.runMigrations();
    expect(ran.map(({ name }) => name)).toEqual(MIGRATIONS.map(({ migration }) => migration.name));

    for (let i = 0; i < MIGRATIONS.length; i++) {
      await ds.undoLastMigration();
    }
    expect(await ds.showMigrations()).toBe(true);
    expect((await tableNames(ds)).filter((name) => name.startsWith('auth_'))).toEqual([]);

    const rerun = await ds.runMigrations();
    expect(rerun).toHaveLength(MIGRATIONS.length);
    expect(await ds.showMigrations()).toBe(false);
  });

  it('leaves exactly the current auth tables after a full run', async () => {
    await ds.runMigrations();

    expect((await tableNames(ds)).filter((name) => name.startsWith('auth_'))).toEqual([
      'auth_account_edit_lockouts',
      'auth_authorization_requests',
      'auth_password_reset_tokens',
      'auth_refresh_tokens',
      'auth_users',
    ]);
  });
});
