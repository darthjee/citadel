import type { DataSource } from 'typeorm';
import { columnInfo, insertUser } from './schema-inspection.js';
import { createTestDataSource, resetDatabase, runMigrationsUpTo } from './test-data-source.js';

const TABLE = 'auth_users';

describe('AuthAddUsersStatus20261019120014 (MySQL)', () => {
  let ds: DataSource;
  let userCount: number;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    // Includes the demo seed (AuthSeedDemoUser20260824120004); the spec only relies on
    // "whatever rows exist", never on the demo password.
    await runMigrationsUpTo(ds, 'AuthDropSessions20261018120013');
    await insertUser(ds, 'extra');
    userCount = (await ds.query(`SELECT id FROM ${TABLE}`)).length;

    await runMigrationsUpTo(ds, 'AuthAddUsersStatus20261019120014');
  });

  afterAll(async () => {
    await ds.destroy();
  });

  describe('up', () => {
    it("backfills every existing row to 'approved'", async () => {
      const rows: Array<{ status: string }> = await ds.query(`SELECT status FROM ${TABLE}`);

      expect(userCount).toBeGreaterThanOrEqual(2);
      expect(rows).toHaveLength(userCount);
      expect(rows.every(({ status }) => status === 'approved')).toBe(true);
    });

    it('makes the column NOT NULL with no default', async () => {
      expect(await columnInfo(ds, TABLE, 'status')).toEqual({
        name: 'status',
        type: 'varchar(16)',
        nullable: false,
        default: null,
      });
    });

    it('rejects an insert without status', async () => {
      await expect(insertUser(ds, 'no-status')).rejects.toThrow(/status/);
    });
  });

  describe('down', () => {
    it('drops the column, keeping the rows', async () => {
      await ds.undoLastMigration();

      expect(await columnInfo(ds, TABLE, 'status')).toBeUndefined();
      expect(await ds.query(`SELECT id FROM ${TABLE}`)).toHaveLength(userCount);
    });
  });
});
