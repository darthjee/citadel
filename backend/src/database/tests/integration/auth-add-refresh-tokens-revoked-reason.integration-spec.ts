import type { DataSource } from 'typeorm';
import { columnInfo, insertUser } from './schema-inspection.js';
import { createTestDataSource, resetDatabase, runMigrationsUpTo } from './test-data-source.js';

const TABLE = 'auth_refresh_tokens';

describe('AuthAddRefreshTokensRevokedReason20261018120012 (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await runMigrationsUpTo(ds, 'AuthAddRefreshTokensSession20261018120011');

    const userId = await insertUser(ds, 'alice');
    const rows: Array<[string, string | null]> = [
      ['revoked-1', '2026-02-01 00:00:00'],
      ['active-1', null],
      ['revoked-2', '2026-02-02 00:00:00'],
      ['active-2', null],
    ];
    for (const [hash, revokedAt] of rows) {
      await ds.query(
        `INSERT INTO ${TABLE} (token_hash, user_id, expires_at, revoked_at, session_uuid, started_at)
         VALUES (?, ?, '2027-01-01 00:00:00', ?, UUID(), NOW())`,
        [hash, userId, revokedAt],
      );
    }

    await runMigrationsUpTo(ds, 'AuthAddRefreshTokensRevokedReason20261018120012');
  });

  afterAll(async () => {
    await ds.destroy();
  });

  describe('up', () => {
    it("backfills revoked rows to 'rotated' and leaves active rows NULL", async () => {
      const rows: Array<{ token_hash: string; revoked_reason: string | null }> = await ds.query(
        `SELECT token_hash, revoked_reason FROM ${TABLE} ORDER BY token_hash`,
      );

      expect(rows).toEqual([
        { token_hash: 'active-1', revoked_reason: null },
        { token_hash: 'active-2', revoked_reason: null },
        { token_hash: 'revoked-1', revoked_reason: 'rotated' },
        { token_hash: 'revoked-2', revoked_reason: 'rotated' },
      ]);
    });

    it('adds a nullable column', async () => {
      expect(await columnInfo(ds, TABLE, 'revoked_reason')).toMatchObject({
        type: 'varchar(32)',
        nullable: true,
        default: null,
      });
    });
  });

  describe('down', () => {
    it('drops the column', async () => {
      await ds.undoLastMigration();

      expect(await columnInfo(ds, TABLE, 'revoked_reason')).toBeUndefined();
    });
  });
});
