import type { DataSource } from 'typeorm';
import { columnInfo, indexNames, tableNames } from './schema-inspection.js';
import { createTestDataSource, resetDatabase, runMigrationsUpTo } from './test-data-source.js';

const TABLE = 'auth_sessions';

describe('AuthDropSessions20261018120013 (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await runMigrationsUpTo(ds, 'AuthAddRefreshTokensRevokedReason20261018120012');
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('drops auth_sessions on up', async () => {
    expect(await tableNames(ds)).toContain(TABLE);

    await runMigrationsUpTo(ds, 'AuthDropSessions20261018120013');

    expect(await tableNames(ds)).not.toContain(TABLE);
  });

  it('recreates auth_sessions, empty and with its columns and index, on down', async () => {
    await runMigrationsUpTo(ds, 'AuthDropSessions20261018120013');
    await ds.undoLastMigration();

    expect(await tableNames(ds)).toContain(TABLE);
    expect(await columnInfo(ds, TABLE, 'id')).toMatchObject({ type: 'int', nullable: false });
    expect(await columnInfo(ds, TABLE, 'user_id')).toMatchObject({ type: 'int', nullable: false });
    expect(await columnInfo(ds, TABLE, 'created_at')).toMatchObject({
      type: 'datetime',
      default: 'CURRENT_TIMESTAMP',
    });
    expect(await columnInfo(ds, TABLE, 'last_seen_at')).toMatchObject({
      type: 'datetime',
      default: 'CURRENT_TIMESTAMP',
    });
    expect(await indexNames(ds, TABLE)).toEqual(['idx_auth_sessions_user_id', 'PRIMARY']);
    expect(await ds.query(`SELECT id FROM ${TABLE}`)).toEqual([]);
  });
});
