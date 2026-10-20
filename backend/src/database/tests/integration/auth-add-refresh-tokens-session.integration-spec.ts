import type { DataSource } from 'typeorm';
import { columnInfo, indexNames, insertUser } from './schema-inspection.js';
import { createTestDataSource, resetDatabase, runMigrationsUpTo } from './test-data-source.js';

const TABLE = 'auth_refresh_tokens';
const INDEX = 'idx_auth_refresh_tokens_session_uuid';
const ISSUED_AT = ['2026-01-01 10:00:00', '2026-01-02 11:30:00', '2026-01-03 12:45:00'];

describe('AuthAddRefreshTokensSession20261018120011 (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await runMigrationsUpTo(ds, 'AuthCreateAccountEditLockouts20260914120010');

    const userId = await insertUser(ds, 'alice');
    for (const [i, issuedAt] of ISSUED_AT.entries()) {
      await ds.query(
        `INSERT INTO ${TABLE} (token_hash, user_id, issued_at, expires_at) VALUES (?, ?, ?, ?)`,
        [`hash-${i}`, userId, issuedAt, '2027-01-01 00:00:00'],
      );
    }

    await runMigrationsUpTo(ds, 'AuthAddRefreshTokensSession20261018120011');
  });

  afterAll(async () => {
    await ds.destroy();
  });

  describe('up', () => {
    it('backfills a distinct, non-null session_uuid per row and started_at = issued_at', async () => {
      const rows: Array<{ session_uuid: string | null; same: number }> = await ds.query(
        `SELECT session_uuid, started_at = issued_at AS same FROM ${TABLE} ORDER BY id`,
      );

      expect(rows).toHaveLength(ISSUED_AT.length);
      expect(rows.every(({ session_uuid }) => typeof session_uuid === 'string' && session_uuid.length === 36))
        .toBe(true);
      expect(new Set(rows.map(({ session_uuid }) => session_uuid)).size).toBe(ISSUED_AT.length);
      expect(rows.map(({ same }) => Number(same))).toEqual([1, 1, 1]);
    });

    it('makes both columns NOT NULL', async () => {
      expect(await columnInfo(ds, TABLE, 'session_uuid')).toMatchObject({ type: 'varchar(36)', nullable: false });
      expect(await columnInfo(ds, TABLE, 'started_at')).toMatchObject({ type: 'datetime', nullable: false });
    });

    it('rejects an insert without them', async () => {
      await expect(ds.query(
        `INSERT INTO ${TABLE} (token_hash, user_id, expires_at) VALUES ('hash-x', 1, '2027-01-01 00:00:00')`,
      )).rejects.toThrow(/session_uuid|started_at/);
    });

    it('indexes session_uuid', async () => {
      expect(await indexNames(ds, TABLE)).toContain(INDEX);
    });
  });

  describe('down', () => {
    it('drops both columns and the index, keeping the rows', async () => {
      await ds.undoLastMigration();

      expect(await columnInfo(ds, TABLE, 'session_uuid')).toBeUndefined();
      expect(await columnInfo(ds, TABLE, 'started_at')).toBeUndefined();
      expect(await indexNames(ds, TABLE)).not.toContain(INDEX);
      expect(await ds.query(`SELECT id FROM ${TABLE}`)).toHaveLength(ISSUED_AT.length);
    });
  });
});
